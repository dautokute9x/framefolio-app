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
  // this server-only query uses the service client and selects safe columns only.
  const supabase = createAdminClient();
  const { data: albums } = await supabase
    .from("albums")
    .select(
      "id, owner_id, client_id, title, slug, description, status, visibility, event_date, delivered_at, cover_photo_id, selection_limit, created_at, updated_at, clients(name)"
    )
    .eq("visibility", "public")
    .order("event_date", { ascending: false, nullsFirst: false })
    .limit(limit);

  const items = ((albums ?? []) as unknown as Omit<Album, "password_hash" | "share_token">[]).map(
    (album) => ({ ...album, password_hash: null, share_token: "" })
  ) as (Album & { clients: Pick<Client, "name" | "email"> | null })[];

  const albumIds = items.map((item) => item.id);
  if (!albumIds.length) return [];

  const { data: photos } = await supabase
    .from("photos")
    .select("*")
    .in("album_id", albumIds)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });

  const byAlbum = new Map<string, Photo[]>();
  (photos ?? []).forEach((photo) => {
    const list = byAlbum.get(photo.album_id) ?? [];
    list.push(photo as Photo);
    byAlbum.set(photo.album_id, list);
  });

  const signed = await createSignedPhotoUrls(
    items
      .map((album) => {
        const albumPhotos = byAlbum.get(album.id) ?? [];
        const cover =
          albumPhotos.find((photo) => photo.id === album.cover_photo_id) ??
          albumPhotos[0];
        return cover;
      })
      .filter(Boolean) as Photo[]
  );

  const urlMap = new Map(signed.map((photo) => [photo.id, photo.signedUrl]));

  return items.map((album) => ({
    ...album,
    photo_count: (byAlbum.get(album.id) ?? []).length,
    cover_photo_url: album.cover_photo_id
      ? urlMap.get(album.cover_photo_id) ?? null
      : ((signed.find((photo) => photo.album_id === album.id)?.signedUrl as
          | string
          | null) ?? null),
  }));
}

export async function getDashboardAlbums(
  ownerId: string
): Promise<AlbumCardData[]> {
  const supabase = await createClient();
  const { data: albums } = await supabase
    .from("albums")
    .select("*, clients(name,email)")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  const items = (albums ?? []) as (Album & {
    clients: Pick<Client, "name" | "email"> | null;
  })[];
  const albumIds = items.map((item) => item.id);

  const { data: photos } = albumIds.length
    ? await supabase
        .from("photos")
        .select("*")
        .in("album_id", albumIds)
        .eq("is_archived", false)
        .order("sort_order", { ascending: true })
    : { data: [] as Photo[] };

  const byAlbum = new Map<string, Photo[]>();
  (photos ?? []).forEach((photo) => {
    const list = byAlbum.get(photo.album_id) ?? [];
    list.push(photo as Photo);
    byAlbum.set(photo.album_id, list);
  });

  const covers = items
    .map((album) => {
      const albumPhotos = byAlbum.get(album.id) ?? [];
      return (
        albumPhotos.find((photo) => photo.id === album.cover_photo_id) ??
        albumPhotos[0]
      );
    })
    .filter(Boolean) as Photo[];

  const signed = await createSignedPhotoUrls(covers);
  const urlMap = new Map(signed.map((item) => [item.id, item.signedUrl]));

  return items.map((album) => {
    const albumPhotos = byAlbum.get(album.id) ?? [];
    const cover =
      albumPhotos.find((photo) => photo.id === album.cover_photo_id) ??
      albumPhotos[0];

    return {
      ...album,
      photo_count: albumPhotos.length,
      cover_photo_url: cover ? urlMap.get(cover.id) ?? null : null,
    };
  });
}

export async function getDashboardSummary(ownerId: string) {
  const supabase = await createClient();

  const [{ count: albumCount }, { count: photoCount }, { data: albums }] =
    await Promise.all([
      supabase
        .from("albums")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", ownerId),
      supabase
        .from("photos")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", ownerId),
      supabase.from("albums").select("id").eq("owner_id", ownerId),
    ]);

  const albumIds = (albums ?? []).map((item) => item.id);

  const { count: selectionCount } = albumIds.length
    ? await supabase
        .from("selections")
        .select("*", { count: "exact", head: true })
        .in("album_id", albumIds)
    : { count: 0 };

  return {
    albumCount: albumCount ?? 0,
    photoCount: photoCount ?? 0,
    selectionCount: selectionCount ?? 0,
  };
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
  };
}

/** Photos for an album the caller has already verified access to. */
export async function getGalleryPhotos(albumId: string): Promise<GalleryPhoto[]> {
  const admin = createAdminClient();
  const { data: photos } = await admin
    .from("photos")
    .select("*")
    .eq("album_id", albumId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const signed = await createSignedPhotoUrls((photos ?? []) as Photo[]);
  return signed.map((photo) => ({
    id: photo.id,
    file_name: photo.file_name,
    width: photo.width,
    height: photo.height,
    url: photo.signedUrl,
  }));
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

export async function getSelectionIds(albumId: string, selectionKey: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("selections")
    .select("photo_id")
    .eq("album_id", albumId)
    .eq("selection_key", selectionKey);

  return new Set((data ?? []).map((item) => item.photo_id));
}

export async function recordAlbumView(
  albumId: string,
  viewerIp?: string | null,
  userAgent?: string | null,
  shareToken?: string | null
) {
  const admin = createAdminClient();
  await admin.from("album_views").insert({
    album_id: albumId,
    viewer_ip: viewerIp ?? null,
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
      photos: (Photo & { signedUrl: string | null; selectedAt: string })[];
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
