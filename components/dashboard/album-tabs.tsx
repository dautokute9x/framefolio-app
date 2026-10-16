import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AlbumStatusBadge } from "@/components/album-status-badge";
import { CopyShareButton } from "@/components/copy-share-button";
import { Button } from "@/components/ui/button";
import { buildShareLink, buildSharePath } from "@/lib/data";
import { getSiteOrigin } from "@/lib/site-url";
import type { Album } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Shared header for an album's pages: title, status, share actions and tabs. */
export async function AlbumTabs({
  album,
  active,
}: {
  album: Pick<Album, "id" | "title" | "slug" | "status" | "share_token" | "visibility">;
  active: "upload" | "selections" | "edit";
}) {
  const [t, site] = await Promise.all([getTranslations("album"), getSiteOrigin()]);
  const tabs = [
    { key: "upload", href: `/dashboard/albums/${album.id}/upload` },
    { key: "selections", href: `/dashboard/albums/${album.id}/selections` },
    { key: "edit", href: `/dashboard/albums/${album.id}/edit` },
  ] as const;

  return (
    <div className="space-y-4">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {t("back")}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl sm:text-4xl">{album.title}</h1>
          <div className="mt-2">
            <AlbumStatusBadge status={album.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyShareButton value={buildShareLink(album, site.origin)} label={t("copyLink")} copiedLabel={t("copied")} />
          <Button asChild variant="outline" size="sm">
            <a href={buildSharePath(album)} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              {t("openGallery")}
            </a>
          </Button>
        </div>
      </div>
      <nav className="flex gap-1 border-b border-border" aria-label={t("tabsLabel")}>
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active === tab.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm transition",
              active === tab.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t(`tabs.${tab.key}`)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
