import Link from "next/link";
import { ExternalLink, FolderOpen, ImageIcon, Sparkles } from "lucide-react";
import { AlbumStatusBadge } from "@/components/album-status-badge";
import { CopyShareButton } from "@/components/copy-share-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdminProfile } from "@/lib/auth";
import { buildShareLink, getDashboardAlbums, getDashboardSummary } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const profile = await requireAdminProfile();
  const [summary, albums] = await Promise.all([
    getDashboardSummary(profile.id),
    getDashboardAlbums(profile.id),
  ]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-3">
        {[
          { label: "Albums", value: summary.albumCount, icon: FolderOpen },
          { label: "Photos", value: summary.photoCount, icon: ImageIcon },
          { label: "Selections", value: summary.selectionCount, icon: Sparkles },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-4xl font-semibold">{item.value}</p>
              </div>
              <item.icon className="h-7 w-7 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h1 className="font-display text-3xl">Albums & jobs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your portfolio, private galleries, and selection-ready client work.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/albums/new">Create album</Link>
          </Button>
        </div>

        <div className="divide-y divide-border">
          {albums.map((album) => {
            const shareUrl = buildShareLink(album.slug, album.share_token);

            return (
              <div key={album.id} className="grid gap-5 px-6 py-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold">{album.title}</h2>
                    <AlbumStatusBadge status={album.status} />
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs uppercase tracking-wide">
                      {album.visibility}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    {album.clients?.name ?? "No linked client"} · {album.photo_count} photos · {formatDate(album.event_date)}
                  </p>

                  <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
                    {album.description ?? "No description yet."}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/albums/${album.id}/edit`}>Edit</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/albums/${album.id}/upload`}>Upload photos</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/albums/${album.id}/selections`}>Review selections</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/gallery/${album.slug}${album.visibility === "private" ? `?share=${album.share_token}` : ""}`} target="_blank">
                        Open gallery
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Share link</p>
                  <p className="mt-3 break-all text-sm">{shareUrl}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <CopyShareButton value={shareUrl} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
