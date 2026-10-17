"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertCircle, ArrowUpDown, CheckCircle2, Loader2, Star, Trash2, UploadCloud } from "lucide-react";
import { PhotoArranger } from "@/components/dashboard/photo-arranger";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { setCoverPhoto } from "@/app/dashboard/albums/actions";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET } from "@/lib/constants";
import type { PhotoWithUrl } from "@/lib/types";

type Props = {
  albumId: string;
  initialPhotos: PhotoWithUrl[];
  coverPhotoId: string | null;
};

type QueueItem = {
  id: string;
  name: string;
  state: "queued" | "uploading" | "done" | "error";
  message?: string;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 50 * 1024 * 1024; // must match the bucket limit in the migration
const PREVIEW_LONG_EDGE = 2048;
const CONCURRENCY = 3;

/** Creates a web-size JPEG preview so clients never download the original. */
async function makePreview(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const { width, height } = bitmap;
  const scale = Math.min(1, PREVIEW_LONG_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas not supported");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("preview");
  return { blob, width, height };
}

type UploadTarget = {
  driver: "supabase" | "r2";
  filePath: string;
  previewPath: string | null;
  uploadUrl?: string | null;
  previewUploadUrl?: string | null;
};

export function UploadManager({ albumId, initialPhotos, coverPhotoId }: Props) {
  const t = useTranslations("upload");
  const supabase = useMemo(() => createClient(), []);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [arranging, setArranging] = useState(false);
  const [coverId, setCoverId] = useState<string | null>(coverPhotoId);
  const [coverSaving, setCoverSaving] = useState<string | null>(null);

  async function chooseCover(photoId: string) {
    if (coverSaving) return;
    const next = coverId === photoId ? null : photoId;
    const previous = coverId;
    setCoverId(next);
    setCoverSaving(photoId);
    const result = await setCoverPhoto(albumId, next);
    setCoverSaving(null);
    if (result.ok) toast.success(next ? t("cover.set") : t("cover.cleared"));
    else {
      setCoverId(previous);
      toast.error(t("cover.error"));
    }
  }

  /** Uploads one blob to Supabase Storage or to an R2 presigned URL. Returns an error message or null. */
  async function putFile(
    driver: UploadTarget["driver"],
    path: string,
    url: string | null | undefined,
    body: Blob,
    contentType: string
  ): Promise<string | null> {
    if (driver === "r2") {
      if (!url) return t("errors.noUploadUrl");
      try {
        const response = await fetch(url, { method: "PUT", body, headers: { "Content-Type": contentType } });
        return response.ok ? null : t("errors.http", { status: response.status });
      } catch {
        return t("errors.storageUnreachable");
      }
    }
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, body, { cacheControl: "31536000", contentType, upsert: false });
    return error ? error.message : null;
  }
  const [photos, setPhotos] = useState<PhotoWithUrl[]>(initialPhotos);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [deleting, setDeleting] = useState<Set<string>>(() => new Set());
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploading = queue.some((item) => item.state === "queued" || item.state === "uploading");
  const doneCount = queue.filter((item) => item.state === "done").length;
  const errorCount = queue.filter((item) => item.state === "error").length;

  // Files picked before the page finished loading never fired onChange.
  useEffect(() => {
    if (inputRef.current?.files?.length) void handleFiles(inputRef.current.files);
    // Runs once after hydration only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before closing the tab in the middle of an upload.
  useEffect(() => {
    if (!uploading) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploading]);

  const update = (id: string, patch: Partial<QueueItem>) =>
    setQueue((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  async function uploadOne(item: QueueItem, file: File, waitForPrevious: Promise<void>) {
    update(item.id, { state: "uploading" });

    if (!ACCEPTED_TYPES.includes(file.type)) {
      update(item.id, { state: "error", message: t("errors.type") });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      update(item.id, { state: "error", message: t("errors.size") });
      return;
    }

    let preview: Awaited<ReturnType<typeof makePreview>> | null = null;
    try {
      preview = await makePreview(file);
    } catch {
      preview = null; // fall back to the original if the browser cannot decode it
    }

    // The server picks the storage paths (and, for Cloudflare R2, signs upload URLs).
    let target: UploadTarget;
    try {
      const response = await fetch(`/api/albums/${albumId}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
          previewSize: preview?.blob.size ?? null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        update(item.id, { state: "error", message: payload.error ?? t("errors.prepare") });
        return;
      }
      target = payload as UploadTarget;
    } catch {
      update(item.id, { state: "error", message: t("errors.network") });
      return;
    }

    const originalError = await putFile(target.driver, target.filePath, target.uploadUrl, file, file.type);
    if (originalError) {
      update(item.id, { state: "error", message: originalError });
      return;
    }

    let uploadedPreviewPath: string | null = null;
    if (preview && target.previewPath) {
      const previewError = await putFile(
        target.driver,
        target.previewPath,
        target.previewUploadUrl,
        preview.blob,
        "image/jpeg"
      );
      if (!previewError) uploadedPreviewPath = target.previewPath;
    }
    const filePath = target.filePath;

    // Files go to storage in parallel, but are registered strictly in the
    // order the photographer picked (sorted by file name), so the gallery keeps
    // the camera sequence (DSC_0001, DSC_0002, ...).
    await waitForPrevious;

    try {
      const response = await fetch(`/api/albums/${albumId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath,
          previewPath: uploadedPreviewPath,
          fileName: file.name,
          width: preview?.width ?? null,
          height: preview?.height ?? null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        update(item.id, { state: "error", message: payload.error ?? t("errors.save") });
        return;
      }
      setPhotos((current) => [...current, payload.photo]);
      update(item.id, { state: "done" });
    } catch {
      update(item.id, { state: "error", message: t("errors.network") });
    }
  }

  async function handleFiles(fileList: FileList | File[] | null) {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    const files = Array.from(fileList ?? []).sort((a, b) => collator.compare(a.name, b.name));
    if (!files.length) return;

    const items: QueueItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      state: "queued",
    }));
    setQueue((current) => [...current.filter((item) => item.state !== "done"), ...items]);

    // Upload a few files at a time: faster than one-by-one, gentler than all at once.
    const gates = files.map(() => {
      let release!: () => void;
      const promise = new Promise<void>((resolve) => (release = resolve));
      return { promise, release };
    });
    let cursor = 0;
    const worker = async () => {
      while (cursor < files.length) {
        const index = cursor++;
        const previous = index > 0 ? gates[index - 1].promise : Promise.resolve();
        try {
          await uploadOne(items[index], files[index], previous);
        } finally {
          // Even a failed file keeps its place in line, so later files never
          // overtake earlier ones.
          await previous;
          gates[index].release();
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
    toast.success(t("toast.batchDone", { count: files.length }));

    // Allow choosing the same files again (onChange does not fire otherwise).
    if (inputRef.current) inputRef.current.value = "";
  }

  async function deletePhoto(photoId: string) {
    setDeleting((current) => new Set(current).add(photoId));
    try {
      const response = await fetch(`/api/albums/${albumId}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });
      if (response.ok) {
        setPhotos((current) => current.filter((photo) => photo.id !== photoId));
        setCoverId((current) => (current === photoId ? null : current));
        toast.success(t("toast.deleted"));
      } else {
        const payload = await response.json().catch(() => ({}));
        toast.error(payload.error ?? t("errors.delete"));
      }
    } finally {
      setDeleting((current) => {
        const next = new Set(current);
        next.delete(photoId);
        return next;
      });
    }
  }

  return (
    <div className="space-y-6">
      <label
        className={`block cursor-pointer rounded-2xl border-2 border-dashed bg-card p-8 text-center transition hover:border-primary/40 ${
          dragging ? "border-primary bg-secondary" : "border-border"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          className="sr-only"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-lg font-medium">{t("dropTitle")}</p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{t("dropHint")}</p>
      </label>

      {queue.length ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm" data-upload-queue>
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">
              {uploading ? t("uploading") : t("finished")} · {t("progress", { done: doneCount, total: queue.length })}
              {errorCount ? ` · ${t("errorsCount", { count: errorCount })}` : ""}
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(((doneCount + errorCount) / queue.length) * 100)}%` }} />
          </div>
          <ul className="mt-3 max-h-48 space-y-1 overflow-auto">
            {queue.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                {item.state === "done" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : item.state === "error" ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                ) : (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                )}
                <span className="truncate">{item.name}</span>
                {item.message ? <span className="text-xs text-destructive">— {item.message}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {arranging ? (
        <PhotoArranger
          albumId={albumId}
          photos={photos}
          onDone={(ordered) => {
            if (ordered) setPhotos(ordered);
            setArranging(false);
          }}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t("count", { count: photos.length })}</p>
            {photos.length > 1 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setArranging(true)} disabled={uploading}>
                <ArrowUpDown className="h-4 w-4" />
                {t("arrange.start")}
              </Button>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
            {photos.map((photo) => {
              const isCover = coverId === photo.id;
              return (
                <figure key={photo.id} className="group relative overflow-hidden rounded-xl bg-secondary">
                  <div className="relative aspect-square">
                    {photo.signedUrl ? (
                      <img src={photo.signedUrl} alt={photo.file_name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">{t("noPreview")}</div>
                    )}
                    {isCover ? (
                      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-black">
                        {t("cover.badge")}
                      </span>
                    ) : null}
                  </div>
                  <figcaption className="truncate px-2 py-1.5 text-[11px] text-muted-foreground">{photo.file_name}</figcaption>
                  <button
                    type="button"
                    onClick={() => void chooseCover(photo.id)}
                    aria-pressed={isCover}
                    aria-label={isCover ? t("cover.unset", { name: photo.file_name }) : t("cover.choose", { name: photo.file_name })}
                    title={isCover ? t("cover.unset", { name: photo.file_name }) : t("cover.choose", { name: photo.file_name })}
                    className={`absolute left-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full transition ${
                      isCover
                        ? "bg-amber-400 text-black"
                        : "bg-black/55 text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    }`}
                  >
                    {coverSaving === photo.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Star className={`h-4 w-4 ${isCover ? "fill-current" : ""}`} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(photo.id)}
                    disabled={deleting.has(photo.id)}
                    aria-label={t("deleteLabel", { name: photo.file_name })}
                    className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    {deleting.has(photo.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </figure>
              );
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(open) => !open && setConfirmId(null)}
        title={t("confirmDelete.title")}
        description={t("confirmDelete.body")}
        confirmLabel={t("confirmDelete.confirm")}
        cancelLabel={t("confirmDelete.cancel")}
        destructive
        onConfirm={() => {
          if (confirmId) void deletePhoto(confirmId);
          setConfirmId(null);
        }}
      />
    </div>
  );
}
