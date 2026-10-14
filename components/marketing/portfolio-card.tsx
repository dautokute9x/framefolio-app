import Link from "next/link";
import { ArrowUpRight, Images } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AlbumCardData } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function PortfolioCard({ album }: { album: AlbumCardData }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        {album.cover_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={album.cover_photo_url}
            alt={album.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No cover image
          </div>
        )}
      </div>

      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-2xl">{album.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {album.clients?.name ?? "Personal project"} · {formatDate(album.event_date)}
            </p>
          </div>
          <Images className="mt-1 h-5 w-5 text-muted-foreground" />
        </div>

        <p className="line-clamp-2 text-sm text-muted-foreground">
          {album.description ?? "A curated client story with refined image selection."}
        </p>

        <div className="flex items-center justify-between text-sm">
          <span>{album.photo_count} photos</span>
          <Link href={`/gallery/${album.slug}`} className="inline-flex items-center gap-1 font-medium text-primary">
            View
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
