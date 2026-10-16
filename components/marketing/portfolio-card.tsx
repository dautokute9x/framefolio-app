import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { AlbumCardData } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export async function PortfolioCard({ album }: { album: AlbumCardData }) {
  const [t, locale] = await Promise.all([getTranslations("site"), getLocale()]);
  return (
    <Link href={`/gallery/${album.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-secondary">
        {album.cover_photo_url ? (
          <img
            src={album.cover_photo_url}
            alt={album.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3 className="truncate font-display text-xl">{album.title}</h3>
        <span className="shrink-0 text-xs text-muted-foreground">{t("photoCount", { count: album.photo_count })}</span>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{formatDate(album.event_date, locale)}</p>
    </Link>
  );
}
