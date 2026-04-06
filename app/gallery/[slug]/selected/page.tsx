import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { canAccessAlbum } from "@/lib/album-access";
import { getGalleryAlbumBySlug, getSelectedPhotosForSession } from "@/lib/data";

export default async function SelectedPage({
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

  const access = await canAccessAlbum(payload.album, shareToken);
  if (payload.requiresPassword && !access) notFound();

  const cookieStore = await cookies();
  const selectionKey = cookieStore.get(`gallery-selection-${payload.album.id}`)?.value ?? "";
  const selected = selectionKey
    ? await getSelectedPhotosForSession(payload.album.id, selectionKey)
    : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Selected photos</p>
          <h1 className="mt-2 font-display text-4xl">{payload.album.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{selected.length} image(s) currently shortlisted.</p>
        </div>

        <Button asChild variant="outline">
          <Link href={`/gallery/${slug}${shareToken ? `?share=${shareToken}` : ""}`}>Back to gallery</Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {selected.map((item, index) => (
          <div key={item.id} className="surface overflow-hidden">
            <div className="relative aspect-[4/5] bg-secondary">
              {item.photos.signedUrl ? (
                <Image src={item.photos.signedUrl} alt={item.photos.file_name} fill className="object-cover" />
              ) : null}
            </div>
            <div className="p-4">
              <p className="text-sm font-medium">#{index + 1} · {item.photos.file_name}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
