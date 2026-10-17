"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, ChevronLeft, ChevronRight, Download, Heart, Loader2, Lock, MessageSquare, Send, X } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/gallery/theme-toggle";
import { Button } from "@/components/ui/button";
import type { GalleryPhoto, PublicAlbum } from "@/lib/types";
import { cn } from "@/lib/utils";

type SessionInfo = {
  selectorName: string;
  selectorEmail: string;
  note: string;
  submittedAt: string | null;
};

/** Signed URLs requested per call to /api/gallery/[slug]/urls. */
const URL_BATCH = 60;
/** Tiles closer than this to the viewport get their URL ahead of time. */
const PREFETCH_MARGIN = "1500px 0px";
/** Tiles rendered at first, and added each time the visitor nears the end. */
const TILE_PAGE = 120;

/** Width / height, clamped so a panorama or a sliver cannot wreck a row. */
function ratioOf(photo: GalleryPhoto) {
  if (!photo.width || !photo.height) return 1;
  return Math.min(2.5, Math.max(0.5, photo.width / photo.height));
}

/**
 * Signed preview URLs, fetched in batches as photos come near the screen.
 * The page only ships URLs for the first photos, so big albums load fast.
 */
function usePhotoUrls(slug: string, shareToken: string | null | undefined, photos: GalleryPhoto[]) {
  const [urls, setUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(photos.filter((photo) => photo.url).map((photo) => [photo.id, photo.url as string]))
  );
  // Ids that already have a URL or are being fetched.
  const known = useRef(new Set(Object.keys(urls)));
  const queue = useRef(new Set<string>());
  const timer = useRef<number | null>(null);
  const failures = useRef(0);
  const refreshed = useRef(new Set<string>());

  const request = useCallback(
    (ids: string[]) => {
      let added = false;
      for (const id of ids) {
        if (known.current.has(id)) continue;
        known.current.add(id);
        queue.current.add(id);
        added = true;
      }
      if (!added || timer.current !== null) return;

      // Collect the ids from one scroll burst into a few requests.
      timer.current = window.setTimeout(async () => {
        timer.current = null;
        const pending = [...queue.current];
        queue.current.clear();
        for (let i = 0; i < pending.length; i += URL_BATCH) {
          const chunk = pending.slice(i, i + URL_BATCH);
          try {
            const response = await fetch(`/api/gallery/${slug}/urls`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: chunk, shareToken }),
            });
            if (!response.ok) throw new Error(String(response.status));
            const payload = (await response.json()) as { urls: Record<string, string> };
            failures.current = 0;
            setUrls((current) => ({ ...current, ...payload.urls }));
            for (const id of chunk) if (!payload.urls[id]) known.current.delete(id);
          } catch {
            // Offline or server hiccup: forget these ids and retry a few times.
            for (const id of chunk) known.current.delete(id);
            failures.current += 1;
            if (failures.current <= 3) window.setTimeout(() => request(chunk), 2000 * failures.current);
          }
        }
      }, 40);
    },
    [shareToken, slug]
  );

  /** A URL failed to load (usually expired after hours open): fetch a fresh one, once per photo. */
  const refresh = useCallback(
    (id: string) => {
      if (refreshed.current.has(id)) return false;
      refreshed.current.add(id);
      known.current.delete(id);
      setUrls((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      request([id]);
      return true;
    },
    [request]
  );

  return { urls, request, refresh };
}

export function ClientGallery({
  album,
  photos,
  initiallySelected,
  initialComments = {},
  shareToken,
  selectionOpen,
  initialSession,
}: {
  album: PublicAlbum;
  photos: GalleryPhoto[];
  initiallySelected: string[];
  initialComments?: Record<string, string>;
  shareToken?: string | null;
  selectionOpen: boolean;
  initialSession: SessionInfo | null;
}) {
  const t = useTranslations("gallery");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initiallySelected));
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<"all" | "selected">("all");
  const [toast, setToast] = useState<string>("");
  const [viewer, setViewer] = useState<{ ids: string[]; index: number } | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>(initialComments);
  const [locked, setLocked] = useState(!selectionOpen);
  const [session, setSession] = useState<SessionInfo>(
    initialSession ?? { selectorName: "", selectorEmail: "", note: "", submittedAt: null }
  );

  const limit = album.selection_limit;
  const count = selected.size;
  const shareQuery = shareToken ? `?share=${encodeURIComponent(shareToken)}` : "";
  const { urls, request, refresh } = usePhotoUrls(album.slug, shareToken, photos);

  // Refs let the tap handler stay the same function between renders, so the
  // memoised tiles do not all re-render when one heart changes.
  const selectedRef = useRef(selected);
  const pendingRef = useRef(new Set<string>());
  const stateRef = useRef({ locked, limit, session, t });
  useEffect(() => {
    stateRef.current = { locked, limit, session, t };
  });

  const photoById = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);
  const numberById = useMemo(() => new Map(photos.map((photo, index) => [photo.id, index + 1])), [photos]);
  const visiblePhotos = useMemo(
    () => (filter === "selected" ? photos.filter((photo) => selected.has(photo.id)) : photos),
    [filter, photos, selected]
  );

  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 4000);
  }, []);

  const setPhotoSelected = useCallback((photoId: string, on: boolean) => {
    const next = new Set(selectedRef.current);
    if (on) next.add(photoId);
    else next.delete(photoId);
    selectedRef.current = next;
    setSelected(next);
  }, []);

  const setPhotoPending = useCallback((photoId: string, on: boolean) => {
    if (on) pendingRef.current.add(photoId);
    else pendingRef.current.delete(photoId);
    setPending(new Set(pendingRef.current));
  }, []);

  const toggle = useCallback(
    async (photoId: string) => {
      const { locked, limit, session, t } = stateRef.current;
      if (locked) {
        showToast(t("lockedToast"));
        return;
      }
      // Ignore taps while the previous request for this photo is still in flight.
      if (pendingRef.current.has(photoId)) return;

      const shouldSelect = !selectedRef.current.has(photoId);
      if (shouldSelect && limit && selectedRef.current.size >= limit) {
        showToast(t("limitReached", { limit }));
        return;
      }

      setPhotoPending(photoId, true);
      // Optimistic: the heart reacts instantly, even on slow mobile networks.
      setPhotoSelected(photoId, shouldSelect);

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
        if (response.ok && !shouldSelect) {
          // The pick is gone, and its note with it.
          setComments((current) => {
            if (!(photoId in current)) return current;
            const next = { ...current };
            delete next[photoId];
            return next;
          });
        }
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setPhotoSelected(photoId, !shouldSelect);
          if (response.status === 423) setLocked(true);
          showToast(payload.error ?? t("saveFailed"));
        }
      } catch {
        setPhotoSelected(photoId, !shouldSelect);
        showToast(t("offline"));
      } finally {
        setPhotoPending(photoId, false);
      }
    },
    [album.slug, setPhotoPending, setPhotoSelected, shareToken, showToast]
  );

  const saveComment = useCallback(
    async (photoId: string, text: string) => {
      const { t } = stateRef.current;
      try {
        const response = await fetch(`/api/gallery/${album.slug}/comment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId, comment: text, shareToken }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 423) setLocked(true);
          showToast(payload.error ?? t("saveFailed"));
          return false;
        }
        setComments((current) => {
          const next = { ...current };
          if (payload.comment) next[photoId] = payload.comment;
          else delete next[photoId];
          return next;
        });
        showToast(t("noteSaved"));
        return true;
      } catch {
        showToast(t("offline"));
        return false;
      }
    },
    [album.slug, shareToken, showToast]
  );

  // One observer for every tile: ask for URLs shortly before tiles scroll into view.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const waiting = useRef(new Set<Element>());
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const ids = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => (entry.target as HTMLElement).dataset.photoId)
          .filter((id): id is string => Boolean(id));
        if (ids.length) request(ids);
      },
      { rootMargin: PREFETCH_MARGIN }
    );
    observerRef.current = observer;
    waiting.current.forEach((element) => observer.observe(element));
    waiting.current.clear();
    return () => observer.disconnect();
  }, [request]);

  const observe = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    const observer = observerRef.current;
    if (observer) observer.observe(element);
    else waiting.current.add(element);
    return () => {
      observerRef.current?.unobserve(element);
      waiting.current.delete(element);
    };
  }, []);

  // Render tiles progressively: a 1000-photo album no longer means 1000 tiles of HTML up front.
  const [rendered, setRendered] = useState(TILE_PAGE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = rendered < visiblePhotos.length;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setRendered((current) => current + TILE_PAGE);
      },
      { rootMargin: "2000px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, rendered]);

  const visibleRef = useRef(visiblePhotos);
  useEffect(() => {
    visibleRef.current = visiblePhotos;
  }, [visiblePhotos]);

  const openViewer = useCallback((photoId: string) => {
    // Snapshot the list, so unselecting inside the "Selected" filter does not
    // pull the photo out from under the viewer.
    const ids = visibleRef.current.map((photo) => photo.id);
    setViewer({ ids, index: Math.max(0, ids.indexOf(photoId)) });
  }, []);

  return (
    <div className="pb-32">
      <header className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{t("eyebrow")}</p>
            <h1 className="mt-1 break-words font-display text-3xl leading-tight sm:text-4xl">{album.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("intro", { count: photos.length })}
          {limit ? ` ${t("limitHint", { limit })}` : ""}
        </p>
      </header>

      <div className="sticky top-0 z-30 mt-4 border-y border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-2 sm:px-6">
          <div className="flex rounded-full border border-border bg-card p-1 text-sm" role="tablist">
            {(["all", "selected"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  "h-9 rounded-full px-4 transition",
                  filter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {key === "all" ? t("filterAll", { count: photos.length }) : t("filterSelected", { count })}
              </button>
            ))}
          </div>
        </div>
      </div>

      {locked ? (
        <div className="mx-4 mt-3 flex max-w-6xl items-start gap-3 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm sm:mx-6 lg:mx-auto">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {session.submittedAt ? t("lockedSubmitted") : t("locked")} {t("lockedContact")}
          </p>
        </div>
      ) : null}

      {photos.length === 0 ? (
        <p className="mx-auto mt-10 max-w-md px-4 text-center text-sm text-muted-foreground">{t("noPhotos")}</p>
      ) : null}

      {filter === "selected" && count === 0 && photos.length > 0 ? (
        <p className="mx-auto mt-10 max-w-md px-4 text-center text-sm text-muted-foreground">{t("noneSelected")}</p>
      ) : null}

      {/* Justified rows: each tile keeps its photo's proportions and every row fills the width. */}
      <section
        data-gallery-grid
        className="mx-auto flex max-w-6xl flex-wrap items-start gap-1.5 px-1.5 pt-3 [--row-h:120px] after:grow-[1000000] after:basis-0 after:content-[''] sm:gap-2 sm:px-6 sm:[--row-h:200px] lg:[--row-h:240px]"
      >
        {visiblePhotos.slice(0, rendered).map((photo, index) => (
          <PhotoTile
            key={photo.id}
            photo={photo}
            number={numberById.get(photo.id) ?? index + 1}
            url={urls[photo.id] ?? null}
            active={selected.has(photo.id)}
            loading={pending.has(photo.id)}
            eager={index < 8}
            observe={observe}
            onOpen={openViewer}
            onToggle={toggle}
            onImageError={refresh}
          />
        ))}
      </section>
      {hasMore ? <div ref={sentinelRef} aria-hidden className="h-px" /> : null}

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
          // Above the viewer's controls when a photo is open, above the bottom bar otherwise.
          className={cn(
            "fixed inset-x-4 z-[60] mx-auto max-w-md rounded-xl bg-foreground px-4 py-3 text-center text-sm text-background shadow-lg",
            viewer ? "top-16" : "bottom-24"
          )}
        >
          {toast}
        </div>
      ) : null}

      {viewer ? (
        <Viewer
          ids={viewer.ids}
          index={viewer.index}
          photoById={photoById}
          numberById={numberById}
          urls={urls}
          selected={selected}
          pending={pending}
          count={count}
          limit={limit}
          request={request}
          onImageError={refresh}
          onIndex={(index) => setViewer((current) => (current ? { ...current, index } : current))}
          onClose={() => setViewer(null)}
          onToggle={toggle}
          comments={comments}
          canComment={!locked}
          onSaveComment={saveComment}
          downloadHref={
            album.allow_download
              ? (id: string) => `/api/gallery/${album.slug}/download/${id}${shareToken ? `?share=${encodeURIComponent(shareToken)}` : ""}`
              : null
          }
        />
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

const PhotoTile = memo(function PhotoTile({
  photo,
  number,
  url,
  active,
  loading,
  eager,
  observe,
  onOpen,
  onToggle,
  onImageError,
}: {
  photo: GalleryPhoto;
  number: number;
  url: string | null;
  active: boolean;
  loading: boolean;
  eager: boolean;
  observe: (element: HTMLElement | null) => (() => void) | undefined;
  onOpen: (photoId: string) => void;
  onToggle: (photoId: string) => Promise<void>;
  onImageError: (photoId: string) => boolean;
}) {
  const t = useTranslations("gallery");
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const ratio = ratioOf(photo);
  const failed = url !== null && failedUrl === url;

  return (
    <div
      ref={observe}
      data-photo-tile
      data-photo-id={photo.id}
      style={{ flexGrow: ratio, flexBasis: `calc(var(--row-h) * ${ratio})`, aspectRatio: String(ratio) }}
      className={cn(
        "relative overflow-hidden rounded-lg bg-secondary [content-visibility:auto]",
        active && "ring-[3px] ring-primary"
      )}
    >
      <button
        type="button"
        className="absolute inset-0 block h-full w-full"
        onClick={() => onOpen(photo.id)}
        aria-label={t("viewPhoto", { number })}
      >
        {url && !failed ? (
          // Plain <img>: short-lived signed links to web-size previews, so
          // next/image optimisation would only re-process every new token.
          <img
            key={url}
            src={url}
            alt={t("photoAlt", { number })}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            onError={() => {
              if (!onImageError(photo.id)) setFailedUrl(url);
            }}
            onContextMenu={(event) => event.preventDefault()}
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover"
          />
        ) : failed ? (
          <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-muted-foreground">
            {t("imageError")}
          </span>
        ) : (
          <span className="absolute inset-0 animate-pulse bg-muted" />
        )}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium text-foreground">
          #{number}
        </span>
      </button>

      <button
        type="button"
        data-select-button
        aria-pressed={active}
        aria-label={active ? t("unselectPhoto", { number }) : t("selectPhoto", { number })}
        onClick={() => void onToggle(photo.id)}
        className={cn(
          "absolute bottom-1.5 right-1.5 flex h-11 w-11 items-center justify-center rounded-full shadow backdrop-blur transition active:scale-95",
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
});

function Viewer({
  ids,
  index,
  photoById,
  numberById,
  urls,
  selected,
  pending,
  count,
  limit,
  request,
  onImageError,
  onIndex,
  onClose,
  onToggle,
  comments,
  canComment,
  onSaveComment,
  downloadHref,
}: {
  ids: string[];
  index: number;
  photoById: Map<string, GalleryPhoto>;
  numberById: Map<string, number>;
  urls: Record<string, string>;
  selected: Set<string>;
  pending: Set<string>;
  count: number;
  limit: number | null;
  request: (ids: string[]) => void;
  onImageError: (photoId: string) => boolean;
  onIndex: (index: number) => void;
  onClose: () => void;
  onToggle: (photoId: string) => Promise<void>;
  comments: Record<string, string>;
  canComment: boolean;
  onSaveComment: (photoId: string, text: string) => Promise<boolean>;
  downloadHref: ((photoId: string) => string) | null;
}) {
  const t = useTranslations("gallery");
  const photoId = ids[index];
  const comment = comments[photoId] ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const photo = photoById.get(photoId);
  const url = urls[photoId];
  const isSelected = selected.has(photoId);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);

  const go = useCallback(
    (delta: number) => onIndex(Math.min(ids.length - 1, Math.max(0, index + delta))),
    [ids.length, index, onIndex]
  );

  // URLs for this photo and its neighbours; warm the browser cache for the next ones.
  useEffect(() => {
    const around = ids.slice(Math.max(0, index - 1), index + 3);
    request(around);
    for (const id of around) {
      const next = urls[id];
      if (next && id !== photoId) new Image().src = next;
    }
  }, [ids, index, photoId, request, urls]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Typing a note must not flip photos or toggle the selection.
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        if (event.key === "Escape") setEditing(false);
        return;
      }
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
      else if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        void onToggle(photoId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, onToggle, photoId]);

  // A half-typed note belongs to the photo it was typed on.
  useEffect(() => setEditing(false), [photoId]);

  // Lock page scroll and hand focus back to where it was on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, []);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={t("photoAlt", { number: numberById.get(photoId) ?? index + 1 })}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchStartX.current === null) return;
        const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
        if (delta < -50) go(1);
        if (delta > 50) go(-1);
        touchStartX.current = null;
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
        <span className="tabular-nums">
          <span className="font-semibold">#{numberById.get(photoId)}</span>
          <span className="ml-2 text-white/60">
            {index + 1} / {ids.length}
          </span>
        </span>
        <button ref={closeRef} type="button" aria-label={t("close")} onClick={onClose} className="rounded-full p-2 hover:bg-white/10">
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2">
        {url ? (
          <img
            key={url}
            src={url}
            alt={photo.file_name}
            onError={() => onImageError(photoId)}
            onContextMenu={(event) => event.preventDefault()}
            draggable={false}
            className="max-h-full max-w-full select-none object-contain"
          />
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-white/60" />
        )}
        <button
          type="button"
          aria-label={t("previous")}
          disabled={index === 0}
          onClick={() => go(-1)}
          className="absolute left-2 hidden rounded-full bg-white/10 p-2 transition hover:bg-white/20 disabled:opacity-30 sm:block"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
        <button
          type="button"
          aria-label={t("next")}
          disabled={index === ids.length - 1}
          onClick={() => go(1)}
          className="absolute right-2 hidden rounded-full bg-white/10 p-2 transition hover:bg-white/20 disabled:opacity-30 sm:block"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      </div>

      <div className="gallery-safe-bottom px-4 py-3">
        {isSelected && (comment || canComment) ? (
          <div className="mx-auto mb-3 max-w-xl">
            {editing ? (
              <form
                className="flex gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setSavingNote(true);
                  const ok = await onSaveComment(photoId, draft);
                  setSavingNote(false);
                  if (ok) setEditing(false);
                }}
              >
                <input
                  autoFocus
                  value={draft}
                  maxLength={500}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={t("notePlaceholderPhoto")}
                  aria-label={t("notePlaceholderPhoto")}
                  className="h-11 min-w-0 flex-1 rounded-full border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/50"
                />
                <button type="submit" disabled={savingNote} className="h-11 rounded-full bg-white px-4 text-sm font-medium text-black disabled:opacity-60">
                  {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : t("saveNote")}
                </button>
              </form>
            ) : (
              <button
                type="button"
                disabled={!canComment}
                onClick={() => {
                  setDraft(comment);
                  setEditing(true);
                }}
                className="flex w-full items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-left text-sm text-white/85 transition hover:bg-white/15 disabled:cursor-default"
                data-photo-note
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate">{comment || t("addNote")}</span>
              </button>
            )}
          </div>
        ) : null}
        <div className="relative flex items-center justify-center gap-2">
          <p className="absolute left-2 hidden text-xs text-white/50 lg:block">{t("keyboardHint")}</p>
          <button
            type="button"
            onClick={() => void onToggle(photoId)}
            aria-pressed={isSelected}
            className={cn(
              "flex h-12 items-center gap-2 rounded-full px-6 text-sm font-medium transition active:scale-95",
              isSelected ? "bg-white text-black" : "bg-white/15 text-white hover:bg-white/25"
            )}
          >
            {pending.has(photoId) ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isSelected ? (
              <Check className="h-5 w-5" />
            ) : (
              <Heart className="h-5 w-5" />
            )}
            {isSelected ? t("selected") : t("selectThis")}
            <span className="text-xs opacity-70">
              ({count}
              {limit ? `/${limit}` : ""})
            </span>
          </button>
          {downloadHref ? (
            <a
              href={downloadHref(photoId)}
              aria-label={t("download")}
              title={t("download")}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            >
              <Download className="h-5 w-5" />
            </a>
          ) : null}
        </div>
      </div>
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

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

  const field = "w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="gallery-safe-bottom w-full max-w-md space-y-4 rounded-t-3xl bg-background p-6 shadow-xl sm:rounded-3xl"
      >
        <div>
          <h2 id="submit-title" className="font-display text-2xl">
            {t("submitTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("submitBody", { count, limit: limit ?? 0 })}</p>
        </div>
        <input
          required
          autoFocus
          name="selectorName"
          autoComplete="name"
          placeholder={t("namePlaceholder")}
          aria-label={t("namePlaceholder")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={cn(field, "h-11")}
        />
        <input
          type="email"
          name="selectorEmail"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          aria-label={t("emailPlaceholder")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={cn(field, "h-11")}
        />
        <textarea
          name="note"
          placeholder={t("notePlaceholder")}
          aria-label={t("notePlaceholder")}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className={cn(field, "py-2")}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            {t("later")}
          </Button>
          <Button type="submit" className="flex-1" loading={saving} disabled={!name.trim()}>
            {t("confirmSubmit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
