import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { GalleryPasswordGate } from "@/components/gallery/gallery-password-gate";
import { ClientGallery } from "@/components/gallery/client-gallery";
import { canAccessAlbum } from "@/lib/album-access";
import { getGalleryAlbumBySlug, getSelectionIds, recordAlbumView } from "@/lib/data";
import { cookies } from "next/headers";

export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = (await searchParams) ?? {};
  const shareToken = typeof query.share === "string" ? query.share : null;

  const payload = await getGalleryAlbumBySlug(slug, shareToken);
  if (!payload) notFound();

  if (payload.album.visibility === "private" && !payload.shareTokenValidated) {
    notFound();
  }

  const access = await canAccessAlbum(payload.album, shareToken);
  if (payload.requiresPassword && !access) {
    return (
      <GalleryPasswordGate
        slug={slug}
        title={payload.album.title}
        shareToken={shareToken}
      />
    );
  }

  const headerStore = await headers();
  await recordAlbumView(
    payload.album.id,
    headerStore.get("x-forwarded-for"),
    headerStore.get("user-agent"),
    shareToken
  );

  const cookieStore = await cookies();
  const selectionKey = cookieStore.get(`gallery-selection-${payload.album.id}`)?.value ?? "";
  const selectedIds = selectionKey
    ? Array.from(await getSelectionIds(payload.album.id, selectionKey))
    : [];

  return (
    <div className="bg-[#fbfaf7]">
      <ClientGallery
        slug={slug}
        albumId={payload.album.id}
        albumTitle={payload.album.title}
        photos={payload.photos}
        initiallySelected={selectedIds}
        shareToken={shareToken}
      />
    </div>
  );
}
