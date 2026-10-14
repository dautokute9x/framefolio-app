"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Trash2, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET } from "@/lib/constants";
import { makeStoragePathSegment } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PhotoWithUrl } from "@/lib/types";

type Props = {
  ownerId: string;
  albumId: string;
  initialPhotos: PhotoWithUrl[];
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
  if (!blob) throw new Error("Không tạo được ảnh xem trước");
  return { blob, width, height };
}

export function UploadManager({ ownerId, albumId, initialPhotos }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [photos, setPhotos] = useState<PhotoWithUrl[]>(initialPhotos);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [deleting, setDeleting] = useState<Set<string>>(() => new Set());
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploading = queue.some((item) => item.state === "queued" || item.state === "uploading");
  const doneCount = queue.filter((item) => item.state === "done").length;
  const errorCount = queue.filter((item) => item.state === "error").length;

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
      update(item.id, { state: "error", message: "Chỉ nhận JPG, PNG, WEBP (HEIC/RAW hãy xuất sang JPG trước)" });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      update(item.id, { state: "error", message: "Ảnh lớn hơn 50MB" });
      return;
    }

    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const base = makeStoragePathSegment(file.name.replace(/\.[^.]+$/, "")).slice(0, 80);
    const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${base}`;
    const filePath = `${ownerId}/${albumId}/${unique}.${ext}`;
    const previewPath = `${ownerId}/${albumId}/previews/${unique}.jpg`;

    let preview: Awaited<ReturnType<typeof makePreview>> | null = null;
    try {
      preview = await makePreview(file);
    } catch {
      preview = null; // fall back to the original if the browser cannot decode it
    }

    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(filePath, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      update(item.id, { state: "error", message: uploadError.message });
      return;
    }

    let uploadedPreviewPath: string | null = null;
    if (preview) {
      const { error: previewError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(previewPath, preview.blob, { cacheControl: "31536000", contentType: "image/jpeg", upsert: false });
      if (!previewError) uploadedPreviewPath = previewPath;
    }

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
        update(item.id, { state: "error", message: payload.error ?? "Không lưu được ảnh" });
        return;
      }
      setPhotos((current) => [...current, payload.photo]);
      update(item.id, { state: "done" });
    } catch {
      update(item.id, { state: "error", message: "Mất kết nối khi lưu ảnh" });
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

    // Allow choosing the same files again (onChange does not fire otherwise).
    if (inputRef.current) inputRef.current.value = "";
  }

  async function deletePhoto(photoId: string) {
    if (!window.confirm("Xoá ảnh này khỏi album? Lựa chọn của khách trên ảnh này cũng bị xoá.")) return;
    setDeleting((current) => new Set(current).add(photoId));
    try {
      const response = await fetch(`/api/albums/${albumId}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });
      if (response.ok) {
        setPhotos((current) => current.filter((photo) => photo.id !== photoId));
      } else {
        const payload = await response.json().catch(() => ({}));
        alert(payload.error ?? "Không xoá được ảnh");
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
        className={`surface block cursor-pointer border-dashed p-8 text-center transition hover:border-primary/40 ${
          dragging ? "border-primary bg-secondary" : ""
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
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-lg font-medium">Kéo thả hoặc bấm để chọn nhiều ảnh</p>
        <p className="mt-2 text-sm text-muted-foreground">
          JPG / PNG / WEBP, tối đa 50MB mỗi ảnh. Hệ thống tự tạo bản xem trước 2048px cho khách; ảnh gốc
          không bao giờ được gửi tới khách.
        </p>
      </label>

      {queue.length ? (
        <div className="surface space-y-2 p-4 text-sm" data-upload-queue>
          <p className="font-medium">
            {uploading ? "Đang tải lên…" : "Hoàn tất"} · {doneCount}/{queue.length} thành công
            {errorCount ? ` · ${errorCount} lỗi` : ""}
          </p>
          <ul className="max-h-48 space-y-1 overflow-auto">
            {queue.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                {item.state === "done" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : item.state === "error" ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <span className="truncate">{item.name}</span>
                {item.message ? <span className="text-xs text-destructive">— {item.message}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">{photos.length} ảnh trong album</p>

      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {photos.map((photo) => (
          <div key={photo.id} className="surface overflow-hidden">
            <div className="relative aspect-[4/5] bg-secondary">
              {photo.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.signedUrl}
                  alt={photo.file_name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Không có bản xem trước
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 p-3">
              <p className="min-w-0 truncate text-sm font-medium">{photo.file_name}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Xoá ${photo.file_name}`}
                onClick={() => void deletePhoto(photo.id)}
                disabled={deleting.has(photo.id)}
              >
                {deleting.has(photo.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
