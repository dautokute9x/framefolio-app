 "use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Loader2, Trash2, UploadCloud } from "lucide-react";
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

type ManagedPhoto = PhotoWithUrl;

export function UploadManager({ ownerId, albumId, initialPhotos }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [photos, setPhotos] = useState<ManagedPhoto[]>(initialPhotos);
  const [status, setStatus] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setStatus("Uploading photos...");
    let nextSortOrder = Math.max(0, ...photos.map((photo) => photo.sort_order)) + 1;

    for (const file of Array.from(fileList)) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${ownerId}/${albumId}/${Date.now()}-${makeStoragePathSegment(file.name.replace(`.${ext}`, ""))}.${ext}`;

      const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) {
        setStatus(uploadError.message);
        continue;
      }

      const response = await fetch(`/api/albums/${albumId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: path,
          fileName: file.name,
          width: null,
          height: null,
          sortOrder: nextSortOrder++,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setStatus(payload.error ?? "Failed to register photo");
        continue;
      }

      setPhotos((current) => [...current, payload.photo]);
      setStatus(`Uploaded ${file.name}`);
    }
  }

  function deletePhoto(photoId: string) {
    startTransition(() => {
      void (async () => {
        const response = await fetch(`/api/albums/${albumId}/photos`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId }),
        });

        const payload = await response.json();
        if (!response.ok) {
          setStatus(payload.error ?? "Unable to delete photo");
          return;
        }

        setPhotos((current) => current.filter((photo) => photo.id !== photoId));
        setStatus("Photo removed");
      })();
    });
  }

  return (
    <div className="space-y-6">
      <label className="surface block cursor-pointer border-dashed p-8 text-center transition hover:border-primary/40">
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-lg font-medium">Upload multiple images</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Direct browser upload to Supabase Storage, then register photo metadata automatically.
        </p>
      </label>

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {photos.map((photo) => (
          <div key={photo.id} className="surface overflow-hidden">
            <div className="relative aspect-[4/5] bg-secondary">
              {photo.signedUrl ? (
                <Image src={photo.signedUrl} alt={photo.file_name} fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Preview unavailable</div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{photo.file_name}</p>
                <p className="text-xs text-muted-foreground">{photo.file_path}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => deletePhoto(photo.id)}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
