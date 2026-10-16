"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Heart,
  ImageIcon,
  ImageUp,
  Inbox,
  Lock,
  MoreHorizontal,
  Pencil,
  Search,
  Send,
} from "lucide-react";
import { AlbumStatusBadge, STATUS_KEY } from "@/components/album-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateAlbumStatus } from "@/app/dashboard/albums/actions";
import { copyText } from "@/lib/clipboard";
import { JOB_STATUSES } from "@/lib/constants";
import type { JobStatus } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export type BoardAlbum = {
  id: string;
  title: string;
  status: JobStatus;
  visibility: "public" | "private";
  clientName: string | null;
  eventDate: string | null;
  coverUrl: string | null;
  photoCount: number;
  selectionCount: number;
  selectionLimit: number | null;
  viewCount: number;
  submittedCount: number;
  lastSubmittedAt: string | null;
  hasPassword: boolean;
  sharePath: string;
  shareUrl: string;
};

type Filter = "all" | JobStatus;


export function AlbumBoard({ albums }: { albums: BoardAlbum[] }) {
  const t = useTranslations("dashboard");
  const tStatus = useTranslations("status");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const waiting = albums.filter((album) => album.status === "Editing" && album.submittedCount > 0);
  const empty = albums.filter((album) => album.photoCount === 0);

  const counts = useMemo(() => {
    const map = new Map<Filter, number>([["all", albums.length]]);
    for (const status of JOB_STATUSES) map.set(status, albums.filter((album) => album.status === status).length);
    return map;
  }, [albums]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return albums.filter((album) => {
      if (filter !== "all" && album.status !== filter) return false;
      if (!q) return true;
      const haystack = `${album.title} ${album.clientName ?? ""}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      return haystack.includes(q);
    });
  }, [albums, filter, query]);

  if (!albums.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-medium">{t("empty.title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("empty.body")}</p>
        <Button asChild className="mt-5">
          <Link href="/dashboard/albums/new">{t("newAlbum")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {waiting.length || empty.length ? (
        <section aria-labelledby="todo-heading" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 id="todo-heading" className="text-sm font-semibold">{t("todo.title")}</h2>
          <ul className="mt-3 divide-y divide-border">
            {waiting.map((album) => (
              <li key={`w-${album.id}`} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <Inbox className="h-4 w-4 shrink-0 text-violet-600" />
                  <span className="truncate">{t("todo.submitted", { title: album.title })}</span>
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/albums/${album.id}/selections`}>{t("actions.viewSelections")}</Link>
                </Button>
              </li>
            ))}
            {empty.map((album) => (
              <li key={`e-${album.id}`} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <ImageUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{t("todo.noPhotos", { title: album.title })}</span>
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/albums/${album.id}/upload`}>{t("actions.upload")}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label={t("filterLabel")}>
          {(["all", ...JOB_STATUSES] as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                "h-10 shrink-0 rounded-full border px-3.5 text-sm transition",
                filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {key === "all" ? t("filterAll") : tStatus(STATUS_KEY[key])}
              <span className="ml-1.5 text-xs opacity-70">{counts.get(key) ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="relative block sm:w-64">
          <span className="sr-only">{t("search")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search")}
            className="h-11 w-full rounded-full border border-input bg-card pl-9 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      {visible.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{t("noMatch")}</p>
      )}
    </div>
  );
}

function AlbumCard({ album }: { album: BoardAlbum }) {
  const t = useTranslations("dashboard");
  const tStatus = useTranslations("status");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  const setStatus = (status: JobStatus, message?: string) =>
    startTransition(async () => {
      const result = await updateAlbumStatus(album.id, status);
      if (result.ok) toast.success(message ?? t("toast.statusChanged", { status: tStatus(STATUS_KEY[status]) }));
      else toast.error(t("toast.error"));
    });

  const copyLink = async () => {
    await copyText(album.shareUrl);
    toast.success(t("toast.linkCopied"));
  };

  const sendToClient = async () => {
    await copyText(album.shareUrl);
    setStatus("Sent", t("toast.sent"));
  };

  // One clear next step per album, depending on where it is in the workflow.
  const primary = (() => {
    if (album.photoCount === 0)
      return { label: t("actions.upload"), icon: ImageUp, href: `/dashboard/albums/${album.id}/upload` };
    if (album.status === "Draft") return { label: t("actions.sendToClient"), icon: Send, onClick: sendToClient };
    if (album.status === "Editing" || album.selectionCount > 0)
      return { label: t("actions.viewSelections"), icon: Heart, href: `/dashboard/albums/${album.id}/selections` };
    if (album.status === "Delivered")
      return { label: t("actions.openGallery"), icon: ExternalLink, href: album.sharePath, external: true };
    return { label: t("actions.copyLink"), icon: Copy, onClick: copyLink };
  })();

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <Link href={`/dashboard/albums/${album.id}/upload`} className="relative block aspect-[3/2] bg-secondary" aria-label={album.title}>
        {album.coverUrl ? (
          <img src={album.coverUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
          </span>
        )}
        <span className="absolute left-3 top-3 flex items-center gap-1.5">
          <AlbumStatusBadge status={album.status} className="shadow-sm" />
          {album.visibility === "private" ? (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm" title={t("private")}>
              <Lock className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{album.title}</h3>
            <p className="truncate text-sm text-muted-foreground">
              {[album.clientName, album.eventDate ? formatDate(album.eventDate, locale) : null].filter(Boolean).join(" · ") || t("noClient")}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-1 shrink-0" aria-label={t("actions.more")} disabled={pending}>
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/albums/${album.id}/edit`}><Pencil />{t("actions.edit")}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/albums/${album.id}/upload`}><ImageUp />{t("actions.upload")}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/albums/${album.id}/selections`}><Heart />{t("actions.viewSelections")}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={album.sharePath} target="_blank" rel="noreferrer"><ExternalLink />{t("actions.openGallery")}</a>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copyLink()}><Copy />{t("actions.copyLink")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              {JOB_STATUSES.filter((status) => status !== album.status).map((status) => (
                <DropdownMenuItem key={status} onSelect={() => setStatus(status)}>
                  <CheckCircle2 />
                  {t("actions.markAs", { status: tStatus(STATUS_KEY[status]) })}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1"><dt className="sr-only">{t("stats.photos")}</dt><ImageIcon className="h-3.5 w-3.5" /><dd>{t("stats.photoCount", { count: album.photoCount })}</dd></div>
          <div className="flex items-center gap-1"><dt className="sr-only">{t("stats.selected")}</dt><Heart className="h-3.5 w-3.5" /><dd>{album.selectionLimit ? `${album.selectionCount}/${album.selectionLimit}` : album.selectionCount}</dd></div>
          <div className="flex items-center gap-1"><dt className="sr-only">{t("stats.views")}</dt><Eye className="h-3.5 w-3.5" /><dd>{album.viewCount}</dd></div>
        </dl>

        <div className="mt-auto pt-4">
          {"href" in primary && primary.href ? (
            <Button asChild variant="secondary" className="w-full">
              <Link href={primary.href} target={"external" in primary && primary.external ? "_blank" : undefined}>
                <primary.icon className="h-4 w-4" />
                {primary.label}
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" className="w-full" disabled={pending} onClick={() => void primary.onClick?.()}>
              <primary.icon className="h-4 w-4" />
              {primary.label}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
