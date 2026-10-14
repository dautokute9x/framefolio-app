import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumStatusBadge } from "@/components/album-status-badge";
import { CopyShareButton } from "@/components/copy-share-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminProfile } from "@/lib/auth";
import { getAlbumSelectionReview } from "@/lib/data";
import { setAlbumStatusAction } from "@/app/dashboard/albums/actions";
import { formatDateTime } from "@/lib/utils";

export default async function SelectionResultsPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const profile = await requireAdminProfile();
  const review = await getAlbumSelectionReview(albumId, profile.id);

  if (!review) notFound();
  const { album, groups, photoCount } = review;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="font-display text-3xl">{album.title}</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Khách: {album.clients?.name ?? "—"} · {photoCount} ảnh trong album
              {album.selection_limit ? ` · giới hạn chọn ${album.selection_limit} ảnh` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AlbumStatusBadge status={album.status} />
            {album.status === "Editing" || album.status === "Delivered" ? (
              <form action={setAlbumStatusAction}>
                <input type="hidden" name="albumId" value={album.id} />
                <input type="hidden" name="status" value="Client Selecting" />
                <Button type="submit" size="sm" variant="outline">Mở lại cho khách chọn</Button>
              </form>
            ) : (
              <form action={setAlbumStatusAction}>
                <input type="hidden" name="albumId" value={album.id} />
                <input type="hidden" name="status" value="Editing" />
                <Button type="submit" size="sm" variant="outline">Chốt lựa chọn</Button>
              </form>
            )}
          </div>
        </CardHeader>
      </Card>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Khách chưa chọn ảnh nào.
          </CardContent>
        </Card>
      ) : null}

      {groups.map((group) => {
        const fileNames = group.photos.map((photo) => photo.file_name);
        // Base names without extension, comma separated: paste into the
        // Lightroom / Bridge filename filter to isolate the picked frames.
        const lightroomFilter = fileNames.map((name) => name.replace(/\.[^.]+$/, "")).join(", ");

        return (
          <Card key={group.selectionKey} data-selection-group>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl">
                  {group.name || "Khách chưa nhập tên"}
                  {group.email ? (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">{group.email}</span>
                  ) : null}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {group.photos.length} ảnh ·{" "}
                  {group.session?.submitted_at
                    ? `Đã gửi lúc ${formatDateTime(group.session.submitted_at)}`
                    : "Đang chọn (chưa bấm gửi)"}
                </p>
                {group.session?.note ? (
                  <p className="mt-3 whitespace-pre-line rounded-xl bg-secondary px-3 py-2 text-sm">
                    <span className="font-medium">Ghi chú của khách: </span>
                    {group.session.note}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyShareButton value={fileNames.join("\n")} label="Copy tên file" copiedLabel="Đã copy" />
                <CopyShareButton value={lightroomFilter} label="Copy cho Lightroom" copiedLabel="Đã copy" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {group.photos.map((photo) => (
                  <figure key={photo.id} className="overflow-hidden rounded-xl border border-border bg-white">
                    <div className="relative aspect-[4/5] bg-secondary">
                      {photo.signedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.signedUrl}
                          alt={photo.file_name}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <figcaption className="truncate px-2 py-1.5 text-xs">{photo.file_name}</figcaption>
                  </figure>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Button asChild variant="ghost">
        <Link href="/dashboard">← Về dashboard</Link>
      </Button>
    </div>
  );
}
