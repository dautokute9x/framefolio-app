"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Check, ChevronLeft, ChevronRight, Heart, Loader2, Lock, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GalleryPhoto, PublicAlbum } from "@/lib/types";
import { cn } from "@/lib/utils";

type SessionInfo = {
  selectorName: string;
  selectorEmail: string;
  note: string;
  submittedAt: string | null;
};

export function ClientGallery({
  album,
  photos,
  initiallySelected,
  shareToken,
  selectionOpen,
  initialSession,
}: {
  album: PublicAlbum;
  photos: GalleryPhoto[];
  initiallySelected: string[];
  shareToken?: string | null;
  selectionOpen: boolean;
  initialSession: SessionInfo | null;
}) {
  const router = useRouter();
  const t = useTranslations("gallery");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initiallySelected));
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<"all" | "selected">("all");
  const [toast, setToast] = useState<string>("");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [locked, setLocked] = useState(!selectionOpen);
  const [session, setSession] = useState<SessionInfo>(
    initialSession ?? { selectorName: "", selectorEmail: "", note: "", submittedAt: null }
  );
  const pendingRef = useRef<Set<string>>(new Set());
  const refreshedRef = useRef(false);

  const limit = album.selection_limit;
  const count = selected.size;
  const shareQuery = shareToken ? `?share=${encodeURIComponent(shareToken)}` : "";

  const visiblePhotos = useMemo(
    () => (filter === "selected" ? photos.filter((photo) => selected.has(photo.id)) : photos),
    [filter, photos, selected]
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? "" : current)), 4000);
  }, []);

  const toggle = useCallback(
    async (photoId: string) => {
      if (locked) {
        showToast(t("lockedToast"));
        return;
      }
      // Ignore taps while the previous request for this photo is still in flight
      // (double-taps used to send conflicting requests).
      if (pendingRef.current.has(photoId)) return;

      const shouldSelect = !selected.has(photoId);
      if (shouldSelect && limit && selected.size >= limit) {
        showToast(t("limitReached", { limit }));
        return;
      }

      pendingRef.current.add(photoId);
      setPending(new Set(pendingRef.current));
      // Optimistic update so the heart reacts instantly on slow mobile networks.
      setSelected((current) => {
        const next = new Set(current);
        if (shouldSelect) next.add(photoId);
        else next.delete(photoId);
        return next;
      });

      try {
        const response = await fetch(`/api/gallery/${album.slug}/select`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoId,
            selected: shouldSelect,
            shareToken,
            selectorName: session.selectorName || undefined,
            selectorEmail: session.selectorEmail || undefined,
          }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          // Roll back the optimistic change.
          setSelected((current) => {
            const next = new Set(current);
            if (shouldSelect) next.delete(photoId);
            else next.add(photoId);
            return next;
          });
          if (response.status === 423) setLocked(true);
          showToast(payload.error ?? t("saveFailed"));
        }
      } catch {
        setSelected((current) => {
          const next = new Set(current);
          if (shouldSelect) next.delete(photoId);
          else next.add(photoId);
          return next;
        });
        showToast(t("offline"));
      } finally {
        pendingRef.current.delete(photoId);
        setPending(new Set(pendingRef.current));
      }
    },
    [album.slug, limit, locked, selected, session.selectorEmail, session.selectorName, shareToken, showToast, t]
  );

  // Signed URLs expire; if an image fails (e.g. tab left open for hours) refresh once.
  const handleImageError = useCallback(() => {
    if (refreshedRef.current) return;
    refreshedRef.current = true;
    router.refresh();
  }, [router]);

  const viewerPhoto = viewerIndex !== null ? visiblePhotos[viewerIndex] : null;

  useEffect(() => {
    if (viewerIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewerIndex(null);
      if (event.key === "ArrowRight") setViewerIndex((i) => (i === null ? i : Math.min(i + 1, visiblePhotos.length - 1)));
      if (event.key === "ArrowLeft") setViewerIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [viewerIndex, visiblePhotos.length]);

  const touchStartX = useRef<number | null>(null);

  return (
    <div className="pb-32">
      <section className="sticky top-0 z-30 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{t("eyebrow")}</p>
            <h1 className="mt-1 truncate font-display text-2xl sm:text-3xl">{album.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {t("intro", { count: photos.length })}
              {limit ? ` ${t("limitHint", { limit })}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <div className="flex rounded-full border border-border bg-white p-1 text-sm" role="tablist">
            {(["all", "selected"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full px-3 py-1.5 transition",
                  filter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                {key === "all" ? t("filterAll", { count: photos.length }) : t("filterSelected", { count })}
              </button>
            ))}
          </div>
          </div>
        </div>
      </section>

      {locked ? (
        <div className="mx-auto mt-3 flex max-w-6xl items-start gap-3 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm sm:mx-6 lg:mx-auto">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {session.submittedAt ? t("lockedSubmitted") : t("locked")} {t("lockedContact")}
          </p>
        </div>
      ) : null}

      {photos.length === 0 ? (
        <p className="mx-auto mt-10 max-w-md px-4 text-center text-sm text-muted-foreground">
          {t("noPhotos")}
        </p>
      ) : null}

      {filter === "selected" && count === 0 && photos.length > 0 ? (
        <p className="mx-auto mt-10 max-w-md px-4 text-center text-sm text-muted-foreground">
          {t("noneSelected")}
        </p>
      ) : null}

      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-1.5 px-1.5 pt-3 sm:grid-cols-3 sm:gap-3 sm:px-6 lg:grid-cols-4">
        {visiblePhotos.map((photo, index) => {
          const active = selected.has(photo.id);
          const loading = pending.has(photo.id);
          const number = photos.indexOf(photo) + 1;

          return (
            <div
              key={photo.id}
              data-photo-tile
              className={cn(
                "group relative overflow-hidden rounded-xl bg-secondary shadow-sm transition",
                active ? "ring-[3px] ring-primary" : ""
              )}
            >
              <button
                type="button"
                className="relative block aspect-[4/5] w-full"
                onClick={() => setViewerIndex(index)}
                aria-label={t("viewPhoto", { number })}
              >
                {photo.url ? (
                  // Plain <img>: URLs are short-lived signed links to already
                  // web-sized previews, so next/image optimisation adds no value
                  // and would re-process every new token.
                   
                  <img
                    src={photo.url}
                    alt={t("photoAlt", { number })}
                    loading={index < 6 ? "eager" : "lazy"}
                    decoding="async"
                    onError={handleImageError}
                    onContextMenu={(event) => event.preventDefault()}
                    draggable={false}
                    className="absolute inset-0 h-full w-full select-none object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                    {t("imageError")}
                  </span>
                )}
                <span className="absolute left-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium">
                  #{number}
                </span>
              </button>

              <button
                type="button"
                data-select-button
                aria-pressed={active}
                aria-label={active ? t("unselectPhoto", { number }) : t("selectPhoto", { number })}
                onClick={() => void toggle(photo.id)}
                className={cn(
                  "absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full shadow backdrop-blur transition active:scale-95",
                  active ? "bg-primary text-primary-foreground" : "bg-background/85 text-foreground"
                )}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : active ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Heart className="h-5 w-5" />
                )}
              </button>
            </div>
          );
        })}
      </section>

      {/* Bottom bar */}
      <div className="gallery-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold" data-selected-count>
              {t("selectedCount", { count, limit: limit ?? 0 })}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {session.submittedAt ? t("sentToPhotographer") : t("autoSaved")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/gallery/${album.slug}/selected${shareQuery}`}>{t("review")}</Link>
            </Button>
            {!locked ? (
              <Button size="sm" disabled={count === 0} onClick={() => setSubmitOpen(true)}>
                <Send className="h-4 w-4" />
                {t("submit")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {toast ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-xl bg-foreground px-4 py-3 text-center text-sm text-background shadow-lg"
        >
          {toast}
        </div>
      ) : null}

      {/* Full-screen viewer */}
      {viewerPhoto ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
          role="dialog"
          aria-modal="true"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (touchStartX.current === null || viewerIndex === null) return;
            const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
            if (delta < -50) setViewerIndex(Math.min(viewerIndex + 1, visiblePhotos.length - 1));
            if (delta > 50) setViewerIndex(Math.max(viewerIndex - 1, 0));
            touchStartX.current = null;
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span>
              {viewerIndex! + 1} / {visiblePhotos.length}
            </span>
            <button type="button" aria-label={t("close")} onClick={() => setViewerIndex(null)} className="p-2">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2">
            {viewerPhoto.url ? (
               
              <img
                src={viewerPhoto.url}
                alt={viewerPhoto.file_name}
                onContextMenu={(event) => event.preventDefault()}
                draggable={false}
                className="max-h-full max-w-full select-none object-contain"
              />
            ) : null}
            <button
              type="button"
              aria-label={t("previous")}
              disabled={viewerIndex === 0}
              onClick={() => setViewerIndex((i) => (i === null ? i : Math.max(i - 1, 0)))}
              className="absolute left-2 hidden rounded-full bg-white/10 p-2 disabled:opacity-30 sm:block"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button
              type="button"
              aria-label={t("next")}
              disabled={viewerIndex === visiblePhotos.length - 1}
              onClick={() => setViewerIndex((i) => (i === null ? i : Math.min(i + 1, visiblePhotos.length - 1)))}
              className="absolute right-2 hidden rounded-full bg-white/10 p-2 disabled:opacity-30 sm:block"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          </div>
          <div className="gallery-safe-bottom flex items-center justify-center px-4 py-4">
            <button
              type="button"
              onClick={() => void toggle(viewerPhoto.id)}
              className={cn(
                "flex h-12 items-center gap-2 rounded-full px-6 text-sm font-medium transition active:scale-95",
                selected.has(viewerPhoto.id) ? "bg-white text-black" : "bg-white/15 text-white"
              )}
            >
              {pending.has(viewerPhoto.id) ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : selected.has(viewerPhoto.id) ? (
                <Check className="h-5 w-5" />
              ) : (
                <Heart className="h-5 w-5" />
              )}
              {selected.has(viewerPhoto.id) ? t("selected") : t("selectThis")}
              <span className="text-xs opacity-70">
                ({count}
                {limit ? `/${limit}` : ""})
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {submitOpen ? (
        <SubmitDialog
          slug={album.slug}
          shareToken={shareToken}
          count={count}
          limit={limit}
          session={session}
          onClose={() => setSubmitOpen(false)}
          onSubmitted={(next) => {
            setSession(next);
            setLocked(true);
            setSubmitOpen(false);
            showToast(t("submittedToast"));
          }}
        />
      ) : null}
    </div>
  );
}

function SubmitDialog({
  slug,
  shareToken,
  count,
  limit,
  session,
  onClose,
  onSubmitted,
}: {
  slug: string;
  shareToken?: string | null;
  count: number;
  limit: number | null;
  session: SessionInfo;
  onClose: () => void;
  onSubmitted: (session: SessionInfo) => void;
}) {
  const t = useTranslations("gallery");
  const [name, setName] = useState(session.selectorName);
  const [email, setEmail] = useState(session.selectorEmail);
  const [note, setNote] = useState(session.note);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/gallery/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareToken, selectorName: name, selectorEmail: email, note }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? t("submitFailed"));
        return;
      }
      onSubmitted({ selectorName: name, selectorEmail: email, note, submittedAt: payload.submittedAt });
    } catch {
      setError(t("networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-t-3xl bg-background p-6 shadow-xl sm:rounded-3xl">
        <div>
          <h2 className="font-display text-2xl">{t("submitTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("submitBody", { count, limit: limit ?? 0 })}</p>
        </div>
        <input
          required
          name="selectorName"
          placeholder={t("namePlaceholder")}
          aria-label={t("namePlaceholder")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm"
        />
        <input
          type="email"
          name="selectorEmail"
          placeholder={t("emailPlaceholder")}
          aria-label={t("emailPlaceholder")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm"
        />
        <textarea
          name="note"
          placeholder={t("notePlaceholder")}
          aria-label={t("notePlaceholder")}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            {t("later")}
          </Button>
          <Button type="submit" className="flex-1" disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("confirmSubmit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
