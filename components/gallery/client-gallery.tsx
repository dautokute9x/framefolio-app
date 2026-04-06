 "use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PhotoWithUrl } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ClientGallery({
  slug,
  albumId,
  albumTitle,
  photos,
  initiallySelected,
  shareToken,
}: {
  slug: string;
  albumId: string;
  albumTitle: string;
  photos: PhotoWithUrl[];
  initiallySelected: string[];
  shareToken?: string | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initiallySelected));
  const [selectorName, setSelectorName] = useState("");
  const [selectorEmail, setSelectorEmail] = useState("");
  const [savingIds, setSavingIds] = useState<string[]>([]);

  const count = useMemo(() => selected.size, [selected]);

  async function toggle(photoId: string) {
    setSavingIds((current) => [...current, photoId]);

    const shouldSelect = !selected.has(photoId);
    const response = await fetch(`/api/gallery/${slug}/select`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        albumId,
        photoId,
        selected: shouldSelect,
        selectorName,
        selectorEmail,
        shareToken,
      }),
    });

    const payload = await response.json();
    setSavingIds((current) => current.filter((id) => id !== photoId));

    if (!response.ok) {
      alert(payload.error ?? "Unable to save selection");
      return;
    }

    setSelected((current) => {
      const next = new Set(current);
      if (shouldSelect) next.add(photoId);
      else next.delete(photoId);
      return next;
    });
  }

  return (
    <div className="pb-28">
      <section className="sticky top-0 z-30 border-b border-border/80 bg-background/90 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Client gallery</p>
            <h1 className="mt-1 font-display text-3xl">{albumTitle}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tap images to shortlist favorites. Your selection is saved on this device.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Your name (optional)"
              value={selectorName}
              onChange={(event) => setSelectorName(event.target.value)}
              className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
            />
            <input
              type="email"
              placeholder="Your email (optional)"
              value={selectorEmail}
              onChange={(event) => setSelectorEmail(event.target.value)}
              className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-2 px-2 pt-3 sm:grid-cols-2 sm:gap-3 sm:px-6 lg:grid-cols-3">
        {photos.map((photo, index) => {
          const active = selected.has(photo.id);
          const loading = savingIds.includes(photo.id);

          return (
            <button
              key={photo.id}
              type="button"
              className={cn(
                "group relative overflow-hidden rounded-2xl border bg-secondary text-left shadow-sm transition",
                active ? "border-primary ring-2 ring-primary/20" : "border-transparent"
              )}
              onClick={() => void toggle(photo.id)}
            >
              <div className="relative aspect-[4/5]">
                {photo.signedUrl ? (
                  <Image
                    src={photo.signedUrl}
                    alt={`Photo ${index + 1}`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : null}

                <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                  <span className="rounded-full bg-background/85 px-2 py-1 text-xs font-medium">
                    #{index + 1}
                  </span>
                  <span className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full backdrop-blur",
                    active ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground"
                  )}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </section>

      <div className="gallery-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{count} photos selected</p>
            <p className="text-xs text-muted-foreground">Selections sync to the photographer review page.</p>
          </div>
          <Button asChild>
            <Link href={`/gallery/${slug}/selected${shareToken ? `?share=${shareToken}` : ""}`}>
              Review selected
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
