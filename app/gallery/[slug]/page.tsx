import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { GalleryPasswordGate } from "@/components/gallery/gallery-password-gate";
import { ClientGallery } from "@/components/gallery/client-gallery";
import {
  getSelectionCookieName,
  hasAlbumPasswordAccess,
  isSelectionOpen,
  isShareTokenValid,
} from "@/lib/album-access";
import {
  getGalleryAlbumBySlug,
  getGalleryPhotos,
  getSelectionIds,
  getSelectionSession,
  recordAlbumView,
  toPublicAlbum,
} from "@/lib/data";

// Client galleries are private by nature: keep them out of search engines.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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

  const album = await getGalleryAlbumBySlug(slug);
  // Same response for "does not exist" and "wrong share token" so private
  // albums cannot be discovered by guessing slugs.
  if (!album || !isShareTokenValid(album, shareToken)) notFound();

  if (!(await hasAlbumPasswordAccess(album))) {
    return (
      <GalleryPasswordGate slug={slug} title={album.title} shareToken={shareToken} />
    );
  }

  const cookieStore = await cookies();
  const selectionKey = cookieStore.get(getSelectionCookieName(album.id))?.value ?? "";

  const [photos, selectedIds, session] = await Promise.all([
    getGalleryPhotos(album.id),
    selectionKey ? getSelectionIds(album.id, selectionKey) : Promise.resolve(new Set<string>()),
    getSelectionSession(album.id, selectionKey),
  ]);

  const headerStore = await headers();
  // Fire-and-forget: a failed analytics insert must never break the gallery.
  void recordAlbumView(
    album.id,
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    headerStore.get("user-agent"),
    shareToken
  ).catch(() => undefined);

  return (
    <div className="min-h-screen bg-[#fbfaf7]">
      <ClientGallery
        album={toPublicAlbum(album)}
        photos={photos}
        initiallySelected={Array.from(selectedIds)}
        shareToken={shareToken}
        selectionOpen={isSelectionOpen(album.status)}
        initialSession={
          session
            ? {
                selectorName: session.selector_name ?? "",
                selectorEmail: session.selector_email ?? "",
                note: session.note ?? "",
                submittedAt: session.submitted_at,
              }
            : null
        }
      />
    </div>
  );
}
