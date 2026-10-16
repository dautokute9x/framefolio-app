import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  getSelectionCookieName,
  hasAlbumPasswordAccess,
  isShareTokenValid,
} from "@/lib/album-access";
import {
  getGalleryAlbumBySlug,
  getSelectedPhotosForSession,
  getSelectionSession,
} from "@/lib/data";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
  const shareQuery = shareToken ? `?share=${encodeURIComponent(shareToken)}` : "";

  const album = await getGalleryAlbumBySlug(slug);
  if (!album || !isShareTokenValid(album, shareToken)) notFound();
  if (!(await hasAlbumPasswordAccess(album))) redirect(`/gallery/${slug}${shareQuery}`);

  const cookieStore = await cookies();
  const selectionKey = cookieStore.get(getSelectionCookieName(album.id))?.value ?? "";
  const [selected, session] = await Promise.all([
    selectionKey ? getSelectedPhotosForSession(album.id, selectionKey) : Promise.resolve([]),
    getSelectionSession(album.id, selectionKey),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Ảnh đã chọn</p>
          <h1 className="mt-2 font-display text-4xl">{album.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {selected.length} ảnh
            {album.selection_limit ? ` / tối đa ${album.selection_limit}` : ""}
            {session?.submitted_at
              ? ` · Đã gửi cho nhiếp ảnh gia lúc ${formatDateTime(session.submitted_at)}`
              : " · Chưa gửi cho nhiếp ảnh gia"}
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href={`/gallery/${slug}${shareQuery}`}>Quay lại album</Link>
        </Button>
      </div>

      {selected.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Bạn chưa chọn ảnh nào. Quay lại album và chạm vào biểu tượng trái tim để chọn.
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {selected.map((item) => (
          <div key={item.id} className="surface overflow-hidden">
            <div className="relative aspect-[4/5] bg-secondary">
              {item.photos.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.photos.signedUrl}
                  alt={item.photos.file_name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="p-3">
              <p className="truncate text-xs font-medium">{item.photos.file_name}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
