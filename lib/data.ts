import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHOTO_BUCKET } from "@/lib/constants";
import type {
  Album,
  AlbumCardData,
  Client,
  GalleryAlbumPayload,
  Photo,
  Selection,
} from "@/lib/types";

async function createSignedPhotoUrls(photos: Photo[]) {
  if (!photos.length) return [];

  const admin = createAdminClient();
  const paths = photos.map((item) => item.file_path);
  const { data } = await admin.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, 60 * 60);

  const urlMap = new Map<string, string | null>();
  (data ?? []).forEach((row) => {
    if (!row?.path) return;
    urlMap.set(row.path, row.signedUrl ?? null);
  });

  return photos.map((photo) => ({
    ...photo,
    signedUrl: urlMap.get(photo.file_path) ?? null,
  }));
}

export async function getPublicPortfolioAlbums(
  limit = 6
): Promise<AlbumCardData[]> {
  // Anonymous visitors cannot read albums through RLS, so use the admin client
  // and restrict to public albums without a gallery password.
  const supabase = createAdminClient();
  const { data: albums } = await supabase
    .from("albums")
    .select("*, clients(name,email)")
    .eq("visibility", "public")
    .is("password_hash", null)
    .order("event_date", { ascending: false, nullsFirst: false })
    .limit(limit);

  const items = (albums ?? []) as (Album & {
    clients: Pick<Client, "name" | "email"> | null;
  })[];

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

export async function getGalleryAlbumBySlug(
  slug: string,
  shareToken?: string | null
): Promise<GalleryAlbumPayload | null> {
  // Gallery visitors are usually anonymous; access is enforced in code below
  // and by canAccessAlbum, not by RLS.
  const admin = createAdminClient();
  const { data: albumRow } = await admin
    .from("albums")
    .select("*, clients(name,email)")
    .eq("slug", slug)
    .maybeSingle();

  if (!albumRow) return null;

  const album = albumRow as Album & {
    clients: Pick<Client, "name" | "email"> | null;
  };
  const shareTokenValidated = !!shareToken && shareToken === album.share_token;

  if (album.visibility === "private" && !shareTokenValidated) {
    return {
      album,
      photos: [],
      requiresPassword: !!album.password_hash,
      canAccessWithoutPassword: false,
      shareTokenValidated: false,
      shareToken,
    };
  }

  const { data: photos } = await admin
    .from("photos")
    .select("*")
    .eq("album_id", album.id)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });

  return {
    album,
    photos: await createSignedPhotoUrls((photos ?? []) as Photo[]),
    requiresPassword: !!album.password_hash,
    canAccessWithoutPassword:
      album.visibility === "public" ||
      (shareTokenValidated && !album.password_hash),
    shareTokenValidated,
    shareToken,
  };
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

  const raw = (selections ?? []) as (Selection & { photos: Photo })[];
  const photos = raw.map((item) => item.photos).filter(Boolean);
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

  const { data: selections } = await admin
    .from("selections")
    .select("*, photos(*)")
    .eq("album_id", albumId)
    .order("created_at", { ascending: false });

  const rows = (selections ?? []) as (Selection & { photos: Photo })[];
  const signed = await createSignedPhotoUrls(
    rows.map((row) => row.photos).filter(Boolean)
  );
  const urlMap = new Map(signed.map((item) => [item.id, item.signedUrl]));

  return {
    album,
    selections: rows.map((row) => ({
      ...row,
      photos: {
        ...row.photos,
        signedUrl: urlMap.get(row.photo_id) ?? null,
      },
    })),
  };
}

export function buildShareLink(slug: string, shareToken: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base}/gallery/${slug}?share=${shareToken}`;
}
