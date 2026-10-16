import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GalleryPasswordGate } from "@/components/gallery/gallery-password-gate";
import { ClientGallery } from "@/components/gallery/client-gallery";
import { AlbumExpired } from "@/components/gallery/album-expired";
import {
  albumAvailability,
  getSelectionCookieName,
  hasAlbumPasswordAccess,
  isSelectionOpen,
  isShareTokenValid,
} from "@/lib/album-access";
import {
  getAlbumCoverUrl,
  getGalleryAlbumBySlug,
  getGalleryPhotos,
  getClientSelections,
  getSelectionSession,
  recordAlbumView,
  toPublicAlbum,
} from "@/lib/data";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Client galleries are private by nature: keep them out of search engines,
// but give link previews (Zalo, Messenger…) the album title and cover.
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const query = (await searchParams) ?? {};
  const shareToken = typeof query.share === "string" ? query.share : null;
  const [t, album] = await Promise.all([getTranslations("gallery"), getGalleryAlbumBySlug(slug)]);
  const base: Metadata = { robots: { index: false, follow: false } };
  if (!album || !isShareTokenValid(album, shareToken) || albumAvailability(album) !== "open") {
    return { ...base, title: t("eyebrow") };
  }

  // Password-protected albums never reveal a photo in the preview.
  const cover = album.password_hash ? null : await getAlbumCoverUrl(album);
  return {
    ...base,
    title: album.title,
    description: t("ogDescription"),
    openGraph: {
      title: album.title,
      description: t("ogDescription"),
      type: "website",
      ...(cover ? { images: [{ url: cover }] } : {}),
    },
  };
}

export default async function GalleryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = (await searchParams) ?? {};
  const shareToken = typeof query.share === "string" ? query.share : null;

  const album = await getGalleryAlbumBySlug(slug);
  // Same response for "does not exist" and "wrong share token" so private
  // albums cannot be discovered by guessing slugs.
  if (!album || !isShareTokenValid(album, shareToken)) notFound();
  const availability = albumAvailability(album);
  if (availability === "archived") notFound();
  if (availability === "expired") return <AlbumExpired title={album.title} />;

  if (!(await hasAlbumPasswordAccess(album))) {
    return (
      <GalleryPasswordGate slug={slug} title={album.title} shareToken={shareToken} />
    );
  }

  const cookieStore = await cookies();
  const selectionKey = cookieStore.get(getSelectionCookieName(album.id))?.value ?? "";

  const [photos, picks, session] = await Promise.all([
    getGalleryPhotos(album.id),
    selectionKey ? getClientSelections(album.id, selectionKey) : Promise.resolve(new Map<string, string>()),
    getSelectionSession(album.id, selectionKey),
  ]);

  const headerStore = await headers();
  // Fire-and-forget: a failed analytics insert must never break the gallery.
  // Visitor IPs are not stored (privacy); the user agent is enough to tell devices apart.
  void recordAlbumView(album.id, headerStore.get("user-agent"), shareToken).catch(() => undefined);

  return (
    <>
      <ClientGallery
        album={toPublicAlbum(album)}
        photos={photos}
        initiallySelected={Array.from(picks.keys())}
        initialComments={Object.fromEntries([...picks].filter(([, comment]) => comment))}
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
    </>
  );
}
