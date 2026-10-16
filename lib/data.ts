import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signReadUrls } from "@/lib/storage";
import type {
  Album,
  AlbumCardData,
  Client,
  GalleryPhoto,
  Photo,
  PhotoWithUrl,
  PublicAlbum,
  Selection,
  SelectionSession,
} from "@/lib/types";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6;

/**
 * Signs storage URLs for photos. With `preferPreview` the web-size preview is
 * used when one exists, so clients never download the full-resolution original.
 */
async function createSignedPhotoUrls(
  photos: Photo[],
  { preferPreview = true }: { preferPreview?: boolean } = {}
): Promise<PhotoWithUrl[]> {
  if (!photos.length) return [];

  const pathFor = (photo: Photo) =>
    preferPreview && photo.preview_path ? photo.preview_path : photo.file_path;

  // Each photo is signed against the backend it was uploaded to (Supabase or R2).
  const urlMap = await signReadUrls(
    photos.map((photo) => ({ path: pathFor(photo), storageBucket: photo.storage_bucket })),
    SIGNED_URL_TTL_SECONDS
  );

  return photos.map((photo) => ({
    ...photo,
    signedUrl: urlMap.get(pathFor(photo)) ?? null,
  }));
}

export async function getPublicPortfolioAlbums(
  limit = 6
): Promise<AlbumCardData[]> {
  // Anonymous visitors cannot read `albums` through RLS (owner-only policy), so
  // this server-only query uses the service client; secrets are stripped below.
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("albums")
    .select("*, clients(name), photos:photos!photos_album_id_fkey(count)")
    .eq("visibility", "public")
    .eq("photos.is_archived", false)
    .order("event_date", { ascending: false, nullsFirst: false })
    .limit(limit + 20);
  if (error) console.error("getPublicPortfolioAlbums failed", error.message);

  type Row = Album & { clients: Pick<Client, "name"> | null; photos: { count: number }[] };
  const items = ((data ?? []) as Row[])
    .filter((album) => !album.archived_at)
    .slice(0, limit)
    .map(({ photos, ...album }) => ({
      ...album,
      password_hash: null,
      share_token: "",
      photo_count: photos?.[0]?.count ?? 0,
      clients: album.clients ? { name: album.clients.name, email: null } : null,
    }));

  const covers = await getCoverUrls(supabase, items);
  return items.map((album) => ({ ...album, cover_photo_url: covers.get(album.id) ?? null })) as AlbumCardData[];
}

/**
 * Cover preview URL per album: the chosen cover, or else the first photo.
 * One small query per album without a cover, which is fine at studio scale.
 */
async function getCoverUrls(
  supabase: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>,
  albums: Pick<Album, "id" | "cover_photo_id">[]
) {
  const chosen = albums.map((album) => album.cover_photo_id).filter(Boolean) as string[];
  const [{ data: chosenPhotos }, firstPhotos] = await Promise.all([
    chosen.length
      ? supabase.from("photos").select("*").in("id", chosen).eq("is_archived", false)
      : Promise.resolve({ data: [] as Photo[] }),
    Promise.all(
      albums.map(async (album) => {
        const { data } = await supabase
          .from("photos")
          .select("*")
          .eq("album_id", album.id)
          .eq("is_archived", false)
          .order("sort_order", { ascending: true })
          .limit(1)
          .maybeSingle();
        return data as Photo | null;
      })
    ),
  ]);

  const byId = new Map(((chosenPhotos ?? []) as Photo[]).map((photo) => [photo.id, photo]));
  const coverFor = new Map<string, Photo>();
  albums.forEach((album, index) => {
    const photo = (album.cover_photo_id && byId.get(album.cover_photo_id)) || firstPhotos[index];
    if (photo) coverFor.set(album.id, photo);
  });

  const signed = await createSignedPhotoUrls([...new Map([...coverFor.values()].map((p) => [p.id, p])).values()]);
  const urlById = new Map(signed.map((photo) => [photo.id, photo.signedUrl]));
  const result = new Map<string, string | null>();
  coverFor.forEach((photo, albumId) => result.set(albumId, urlById.get(photo.id) ?? null));
  return result;
}

export type DashboardAlbum = AlbumCardData & {
  selection_count: number;
  view_count: number;
  submitted_count: number;
  last_submitted_at: string | null;
};

/**
 * Albums for the dashboard with cover, counts and submission info.
 * Counts come from PostgREST embedded aggregates, so photos are not loaded.
 */
export async function getDashboardAlbums(ownerId: string): Promise<DashboardAlbum[]> {
  const supabase = await createClient();
  // albums has two foreign keys to photos (album photos and cover photo), so
  // the embed has to name the relationship or PostgREST rejects the query.
  const { data: albums, error } = await supabase
    .from("albums")
    .select(
      "*, clients(name,email), photos:photos!photos_album_id_fkey(count), selections(count), album_views(count), selection_sessions(submitted_at)"
    )
    .eq("owner_id", ownerId)
    .eq("photos.is_archived", false)
    .order("created_at", { ascending: false });
  if (error) console.error("getDashboardAlbums failed", error.message);

  type Row = Album & {
    clients: Pick<Client, "name" | "email"> | null;
    photos: { count: number }[];
    selections: { count: number }[];
    album_views: { count: number }[];
    selection_sessions: { submitted_at: string | null }[];
  };
  const rows = (albums ?? []) as Row[];

  const covers = await getCoverUrls(supabase, rows);

  return rows.map(({ photos, selections, album_views, selection_sessions, ...album }) => {
    const submitted = selection_sessions
      .map((session) => session.submitted_at)
      .filter(Boolean)
      .sort() as string[];
    return {
      ...album,
      photo_count: photos?.[0]?.count ?? 0,
      selection_count: selections?.[0]?.count ?? 0,
      view_count: album_views?.[0]?.count ?? 0,
      submitted_count: submitted.length,
      last_submitted_at: submitted.at(-1) ?? null,
      cover_photo_url: covers.get(album.id) ?? null,
    };
  });
}

/** Client submissions across all albums, newest first (dashboard inbox). */
export async function getInbox(ownerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("selection_sessions")
    .select("id, album_id, selection_key, selector_name, selector_email, note, submitted_at, albums!inner(id, title, status, owner_id, selection_limit)")
    .eq("albums.owner_id", ownerId)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(100);
  if (error) console.error("getInbox failed", error.message);

  type Row = SelectionSession & {
    albums: Pick<Album, "id" | "title" | "status" | "selection_limit">;
  };
  const rows = (data ?? []) as unknown as Row[];

  // Number of photos picked in each submitted session.
  const counts = await Promise.all(
    rows.map(async (row) => {
      const { count } = await supabase
        .from("selections")
        .select("id", { count: "exact", head: true })
        .eq("album_id", row.album_id)
        .eq("selection_key", row.selection_key);
      return count ?? 0;
    })
  );

  return rows.map((row, index) => ({ ...row, photo_count: counts[index] }));
}

/** Albums waiting for the photographer: the client submitted and the album is locked for editing. */
export async function getInboxCount(ownerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("selection_sessions")
    .select("album_id, albums!inner(owner_id, status)")
    .eq("albums.owner_id", ownerId)
    .eq("albums.status", "Editing")
    .not("submitted_at", "is", null);
  return new Set((data ?? []).map((row) => row.album_id)).size;
}

/** Clients with their albums (title, status) for the clients page. */
export async function getClientsWithAlbums(ownerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*, albums(id, title, status, event_date)")
    .eq("owner_id", ownerId)
    .order("name", { ascending: true });
  if (error) console.error("getClientsWithAlbums failed", error.message);
  return (data ?? []) as (Client & { albums: Pick<Album, "id" | "title" | "status" | "event_date">[] })[];
}

export async function getOwnerClients(ownerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("owner_id", ownerId)
    .order("name", { ascending: true });

  return (data ?? []) as Client[];
}

export async function getAlbumForOwner(albumId: string, ownerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("albums")
    .select("*, clients(*)")
    .eq("id", albumId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  return data as (Album & { clients: Client | null }) | null;
}

export async function getAlbumPhotoCount(albumId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("album_id", albumId)
    .eq("is_archived", false);
  return count ?? 0;
}

export async function getUploadPhotosForAlbum(albumId: string, ownerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("photos")
    .select("*")
    .eq("album_id", albumId)
    .eq("owner_id", ownerId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });

  return createSignedPhotoUrls((data ?? []) as Photo[]);
}

type GalleryAlbumRow = Album & { clients: Pick<Client, "name"> | null };

/**
 * Loads an album for the public gallery. Runs with the service client because
 * anonymous visitors have no RLS access to `albums`; every caller MUST check
 * access with `isShareTokenValid` + `hasAlbumPasswordAccess` before exposing photos.
 */
export async function getGalleryAlbumBySlug(slug: string): Promise<GalleryAlbumRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("albums")
    .select("*, clients(name)")
    .eq("slug", slug)
    .maybeSingle();

  return (data as GalleryAlbumRow | null) ?? null;
}

export function toPublicAlbum(album: GalleryAlbumRow): PublicAlbum {
  return {
    id: album.id,
    title: album.title,
    slug: album.slug,
    description: album.description,
    status: album.status,
    visibility: album.visibility,
    event_date: album.event_date,
    selection_limit: album.selection_limit,
    clients: album.clients ? { name: album.clients.name } : null,
    allow_download: album.allow_download === true,
  };
}

/** How many gallery photos get a signed URL in the first HTML; the rest load as the client scrolls. */
export const GALLERY_INITIAL_SIGNED = 48;

/**
 * Photos for an album the caller has already verified access to. Only the
 * first `signCount` carry a URL: signing (and shipping) a URL for every photo
 * made 1000-photo albums ~2MB of HTML. The rest come from /api/gallery/[slug]/urls.
 */
export async function getGalleryPhotos(albumId: string, signCount = GALLERY_INITIAL_SIGNED): Promise<GalleryPhoto[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("photos")
    .select("*")
    .eq("album_id", albumId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const photos = (data ?? []) as Photo[];
  const signed = await createSignedPhotoUrls(photos.slice(0, signCount));
  const urls = new Map(signed.map((photo) => [photo.id, photo.signedUrl]));
  return photos.map((photo) => ({
    id: photo.id,
    file_name: photo.file_name,
    width: photo.width,
    height: photo.height,
    url: urls.get(photo.id) ?? null,
  }));
}

/** Signed preview URLs for some photos of one album (ids from other albums are ignored). */
export async function signGalleryPhotos(albumId: string, ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const admin = createAdminClient();
  const { data } = await admin
    .from("photos")
    .select("*")
    .eq("album_id", albumId)
    .eq("is_archived", false)
    .in("id", ids);
  const signed = await createSignedPhotoUrls((data ?? []) as Photo[]);
  return Object.fromEntries(
    signed.filter((photo) => photo.signedUrl).map((photo) => [photo.id, photo.signedUrl as string])
  );
}

export async function getSelectionSession(albumId: string, selectionKey: string) {
  if (!selectionKey) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("selection_sessions")
    .select("*")
    .eq("album_id", albumId)
    .eq("selection_key", selectionKey)
    .maybeSingle();
  return (data as SelectionSession | null) ?? null;
}

/** The visitor's picks: photo id → their note on it ("" when none). */
export async function getClientSelections(albumId: string, selectionKey: string) {
  const admin = createAdminClient();
  // select("*") keeps working on a database without the 0004 comment column.
  const { data } = await admin
    .from("selections")
    .select("*")
    .eq("album_id", albumId)
    .eq("selection_key", selectionKey);

  return new Map(((data ?? []) as Selection[]).map((row) => [row.photo_id, row.comment ?? ""]));
}

export async function recordAlbumView(albumId: string, userAgent?: string | null, shareToken?: string | null) {
  const admin = createAdminClient();
  await admin.from("album_views").insert({
    album_id: albumId,
    viewer_ip: null,
    viewer_agent: userAgent ?? null,
    share_token: shareToken ?? null,
  } as any);
}

export async function getSelectedPhotosForSession(
  albumId: string,
  selectionKey: string
) {
  const admin = createAdminClient();
  const { data: selections } = await admin
    .from("selections")
    .select("*, photos(*)")
    .eq("album_id", albumId)
    .eq("selection_key", selectionKey)
    .order("created_at", { ascending: true });

  const raw = ((selections ?? []) as (Selection & { photos: Photo | null })[]).filter(
    (item) => !!item.photos && !item.photos.is_archived
  ) as (Selection & { photos: Photo })[];
  const photos = raw.map((item) => item.photos);
  const signed = await createSignedPhotoUrls(photos);
  const urlMap = new Map(signed.map((item) => [item.id, item.signedUrl]));

  return raw.map((item) => ({
    ...item,
    photos: {
      ...item.photos,
      signedUrl: urlMap.get(item.photo_id) ?? null,
    },
  }));
}

export async function getAlbumSelectionReview(albumId: string, ownerId: string) {
  const admin = createAdminClient();
  const { data: album } = await admin
    .from("albums")
    .select("*, clients(name,email)")
    .eq("id", albumId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!album) return null;

  const [{ data: selections }, { data: sessions }, { count: photoCount }] = await Promise.all([
    admin
      .from("selections")
      .select("*, photos(*)")
      .eq("album_id", albumId)
      .order("created_at", { ascending: true }),
    admin
      .from("selection_sessions")
      .select("*")
      .eq("album_id", albumId)
      .order("updated_at", { ascending: false }),
    admin
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("album_id", albumId)
      .eq("is_archived", false),
  ]);

  const rows = ((selections ?? []) as (Selection & { photos: Photo | null })[]).filter(
    (row) => !!row.photos
  ) as (Selection & { photos: Photo })[];
  const signed = await createSignedPhotoUrls(rows.map((row) => row.photos));
  const urlMap = new Map(signed.map((item) => [item.id, item.signedUrl]));

  const sessionMap = new Map(
    ((sessions ?? []) as SelectionSession[]).map((session) => [session.selection_key, session])
  );

  const groups = new Map<
    string,
    {
      selectionKey: string;
      session: SelectionSession | null;
      name: string | null;
      email: string | null;
      photos: (Photo & { signedUrl: string | null; selectedAt: string; comment: string | null })[];
    }
  >();

  for (const row of rows) {
    const group = groups.get(row.selection_key) ?? {
      selectionKey: row.selection_key,
      session: sessionMap.get(row.selection_key) ?? null,
      name: null,
      email: null,
      photos: [],
    };
    group.name = group.session?.selector_name ?? row.selector_name ?? group.name;
    group.email = group.session?.selector_email ?? row.selector_email ?? group.email;
    group.photos.push({
      ...row.photos,
      signedUrl: urlMap.get(row.photo_id) ?? null,
      selectedAt: row.created_at,
      comment: row.comment ?? null,
    });
    groups.set(row.selection_key, group);
  }

  for (const group of groups.values()) {
    group.photos.sort((a, b) => a.sort_order - b.sort_order);
  }

  const ordered = Array.from(groups.values()).sort((a, b) => {
    const aTime = a.session?.submitted_at ?? a.session?.updated_at ?? "";
    const bTime = b.session?.submitted_at ?? b.session?.updated_at ?? "";
    return bTime.localeCompare(aTime);
  });

  return {
    album: album as Album & { clients: Pick<Client, "name" | "email"> | null },
    photoCount: photoCount ?? 0,
    groups: ordered,
  };
}

export function buildSharePath(
  album: Pick<Album, "slug" | "share_token" | "visibility">
) {
  const query = album.visibility === "private" ? `?share=${album.share_token}` : "";
  return `/gallery/${album.slug}${query}`;
}

/** Absolute link for the client. `origin` comes from getSiteOrigin(). */
export function buildShareLink(
  album: Pick<Album, "slug" | "share_token" | "visibility">,
  origin: string
) {
  return `${origin.replace(/\/+$/, "")}${buildSharePath(album)}`;
}

/**
 * Long-lived signed URL of an album's cover preview, used as the Open Graph
 * image when the link is pasted into Zalo / Facebook / Messenger.
 */
export async function getAlbumCoverUrl(album: Pick<Album, "id" | "cover_photo_id">, ttlSeconds = 60 * 60 * 24 * 7) {
  const admin = createAdminClient();
  let query = admin.from("photos").select("*").eq("album_id", album.id).eq("is_archived", false);
  query = album.cover_photo_id ? query.eq("id", album.cover_photo_id) : query.order("sort_order").limit(1);
  const { data } = await query.maybeSingle();
  if (!data) return null;
  const photo = data as Photo;
  const path = photo.preview_path ?? photo.file_path;
  const urls = await signReadUrls([{ path, storageBucket: photo.storage_bucket }], ttlSeconds);
  return urls.get(path) ?? null;
}
