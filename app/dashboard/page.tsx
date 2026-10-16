import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { AlbumBoard } from "@/components/dashboard/album-board";
import { Button } from "@/components/ui/button";
import { requireAdminProfile } from "@/lib/auth";
import { buildShareLink, buildSharePath, getDashboardAlbums } from "@/lib/data";
import { getSiteOrigin } from "@/lib/site-url";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

export default async function DashboardPage() {
  const profile = await requireAdminProfile();
  const [t, albums, site] = await Promise.all([
    getTranslations("dashboard"),
    getDashboardAlbums(profile.id),
    getSiteOrigin(),
  ]);

  const items = albums.map((album) => ({
    id: album.id,
    title: album.title,
    status: album.status,
    visibility: album.visibility,
    clientName: album.clients?.name ?? null,
    eventDate: album.event_date,
    coverUrl: album.cover_photo_url,
    photoCount: album.photo_count,
    selectionCount: album.selection_count,
    selectionLimit: album.selection_limit,
    viewCount: album.view_count,
    submittedCount: album.submitted_count,
    lastSubmittedAt: album.last_submitted_at,
    hasPassword: !!album.password_hash,
    sharePath: buildSharePath(album),
    shareUrl: buildShareLink(album, site.origin),
    archivedAt: album.archived_at ?? null,
    expiresAt: album.expires_at ?? null,
  }));

  return (
    <div className="space-y-6">
      {site.mismatch ? (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-medium">{t("siteUrlMismatch.title")}</p>
          <p className="mt-1">{t("siteUrlMismatch.body", { configured: site.configured ?? "", current: site.current ?? "" })}</p>
        </div>
      ) : null}

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle", { count: items.filter((item) => !item.archivedAt).length })}</p>
        </div>
        <Button asChild className="hidden md:inline-flex">
          <Link href="/dashboard/albums/new">
            <Plus className="h-4 w-4" />
            {t("newAlbum")}
          </Link>
        </Button>
      </div>

      <AlbumBoard albums={items} />
    </div>
  );
}
