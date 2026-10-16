import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Heart } from "lucide-react";
import { AlbumTabs } from "@/components/dashboard/album-tabs";
import { CopyShareButton } from "@/components/copy-share-button";
import { Button } from "@/components/ui/button";
import { requireAdminProfile } from "@/lib/auth";
import { getAlbumSelectionReview } from "@/lib/data";
import { setAlbumStatusAction } from "@/app/dashboard/albums/actions";
import { formatDateTime } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("album.tabs");
  return { title: t("selections") };
}

export default async function SelectionResultsPage({ params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  const profile = await requireAdminProfile();
  const [t, locale, review] = await Promise.all([
    getTranslations("selections"),
    getLocale(),
    getAlbumSelectionReview(albumId, profile.id),
  ]);
  if (!review) notFound();
  const { album, groups, photoCount } = review;
  const locked = album.status === "Editing" || album.status === "Delivered";

  return (
    <div className="space-y-6">
      <AlbumTabs album={album} active="selections" />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {t("summary", { photos: photoCount, clients: groups.length })}
          {album.selection_limit ? ` · ${t("limit", { limit: album.selection_limit })}` : ""}
        </p>
        <form action={setAlbumStatusAction}>
          <input type="hidden" name="albumId" value={album.id} />
          <input type="hidden" name="status" value={locked ? "Client Selecting" : "Editing"} />
          <Button type="submit" size="sm" variant="outline">
            {locked ? t("reopen") : t("lock")}
          </Button>
        </form>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Heart className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : null}

      {groups.map((group) => {
        const fileNames = group.photos.map((photo) => photo.file_name);
        // Base names without extension, comma separated: paste into the
        // Lightroom / Bridge filename filter to isolate the picked frames.
        const lightroomFilter = fileNames.map((name) => name.replace(/\.[^.]+$/, "")).join(", ");

        return (
          <section key={group.selectionKey} className="rounded-2xl border border-border bg-card p-4 sm:p-5" data-selection-group>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">
                  {group.name || t("anonymous")}
                  {group.email ? <span className="ml-2 text-sm font-normal text-muted-foreground">{group.email}</span> : null}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("photoCount", { count: group.photos.length })} ·{" "}
                  {group.session?.submitted_at
                    ? t("submittedAt", { time: formatDateTime(group.session.submitted_at, locale) })
                    : t("inProgress")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyShareButton value={fileNames.join("\n")} label={t("copyFileNames")} copiedLabel={t("copied")} variant="outline" />
                <CopyShareButton value={lightroomFilter} label={t("copyLightroom")} copiedLabel={t("copied")} variant="outline" />
              </div>
            </div>
            {group.session?.note ? (
              <p className="mt-3 whitespace-pre-line rounded-xl bg-secondary px-3 py-2 text-sm">
                <span className="font-medium">{t("clientNote")}: </span>
                {group.session.note}
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {group.photos.map((photo) => (
                <figure key={photo.id} className="overflow-hidden rounded-xl bg-secondary">
                  <div className="relative aspect-square">
                    {photo.signedUrl ? (
                      <img src={photo.signedUrl} alt={photo.file_name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <figcaption className="truncate px-2 py-1.5 text-[11px] text-muted-foreground">{photo.file_name}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
