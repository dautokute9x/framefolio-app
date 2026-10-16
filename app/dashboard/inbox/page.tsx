import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Inbox } from "lucide-react";
import { AlbumStatusBadge } from "@/components/album-status-badge";
import { requireAdminProfile } from "@/lib/auth";
import { getInbox } from "@/lib/data";
import { formatDateTime } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inbox");
  return { title: t("title") };
}

export default async function InboxPage() {
  const profile = await requireAdminProfile();
  const [t, locale, items] = await Promise.all([getTranslations("inbox"), getLocale(), getInbox(profile.id)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/dashboard/albums/${item.album_id}/selections`}
                className="flex flex-col gap-1 px-4 py-4 transition hover:bg-secondary/60 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {item.selector_name || t("anonymous")} <span className="font-normal text-muted-foreground">· {item.albums.title}</span>
                  </p>
                  {item.note ? <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">“{item.note}”</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                  <span>
                    {t("photos", { count: item.photo_count })}
                    {item.albums.selection_limit ? `/${item.albums.selection_limit}` : ""}
                  </span>
                  <span>{formatDateTime(item.submitted_at, locale)}</span>
                  <AlbumStatusBadge status={item.albums.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
