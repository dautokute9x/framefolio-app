"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { FolderOpen, Globe, Inbox, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", key: "albums", icon: FolderOpen, match: (p: string) => p === "/dashboard" || (/^\/dashboard\/albums\/[^/]+/.test(p) && !p.endsWith("/new")) },
  { href: "/dashboard/albums/new", key: "newAlbum", icon: Plus, match: (p: string) => p === "/dashboard/albums/new" },
  { href: "/dashboard/inbox", key: "inbox", icon: Inbox, match: (p: string) => p.startsWith("/dashboard/inbox") },
  { href: "/", key: "site", icon: Globe, match: () => false },
] as const;

/** Desktop: inline links in the top bar. */
export function DashboardTopNav({ inboxCount }: { inboxCount: number }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label={t("label")}>
      {ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          target={item.key === "site" ? "_blank" : undefined}
          aria-current={item.match(pathname) ? "page" : undefined}
          className={cn(
            "relative inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm transition",
            item.match(pathname) ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <item.icon className="h-4 w-4" />
          {t(item.key)}
          {item.key === "inbox" && inboxCount > 0 ? <CountBadge count={inboxCount} /> : null}
        </Link>
      ))}
    </nav>
  );
}

/** Phones: fixed tab bar at the bottom, thumb-reachable. */
export function DashboardBottomNav({ inboxCount }: { inboxCount: number }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("label")}
      className="gallery-safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 pt-1 backdrop-blur md:hidden"
    >
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.key}
            href={item.href}
            target={item.key === "site" ? "_blank" : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]",
              active ? "font-semibold text-foreground" : "text-muted-foreground"
            )}
          >
            <span className="relative">
              <item.icon className="h-5 w-5" />
              {item.key === "inbox" && inboxCount > 0 ? (
                <span className="absolute -right-2.5 -top-1.5">
                  <CountBadge count={inboxCount} />
                </span>
              ) : null}
            </span>
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
