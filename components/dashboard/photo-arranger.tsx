"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDownAZ, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reorderPhotos } from "@/app/dashboard/albums/actions";
import type { PhotoWithUrl } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Drag photos into the order clients will see; works with mouse, touch (press and hold) and keyboard. */
export function PhotoArranger({
  albumId,
  photos,
  onDone,
}: {
  albumId: string;
  photos: PhotoWithUrl[];
  onDone: (ordered: PhotoWithUrl[] | null) => void;
}) {
  const t = useTranslations("upload.arrange");
  const [items, setItems] = useState(photos);
  const [saving, startSaving] = useTransition();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press and hold on phones, so the page still scrolls normally.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setItems((current) => {
      const from = current.findIndex((photo) => photo.id === active.id);
      const to = current.findIndex((photo) => photo.id === over.id);
      return arrayMove(current, from, to);
    });
  }

  function sortByName() {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    setItems((current) => [...current].sort((a, b) => collator.compare(a.file_name, b.file_name)));
  }

  function save() {
    startSaving(async () => {
      const result = await reorderPhotos(
        albumId,
        items.map((photo) => photo.id)
      );
      if (result.ok) {
        toast.success(t("saved"));
        onDone(items);
      } else {
        toast.error(t("error"));
      }
    });
  }

  return (
    <div className="space-y-4" data-photo-arranger>
      <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur">
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={sortByName} disabled={saving}>
            <ArrowDownAZ className="h-4 w-4" />
            {t("byName")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onDone(null)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button type="button" size="sm" onClick={save} loading={saving}>
            {t("save")}
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((photo) => photo.id)} strategy={rectSortingStrategy}>
          <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
            {items.map((photo, index) => (
              <SortablePhoto key={photo.id} photo={photo} position={index + 1} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortablePhoto({ photo, position }: { photo: PhotoWithUrl; position: number }) {
  const t = useTranslations("upload.arrange");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative touch-manipulation select-none overflow-hidden rounded-xl bg-secondary",
        isDragging && "z-10 shadow-premium ring-2 ring-primary"
      )}
      {...attributes}
      {...listeners}
      aria-label={t("item", { position, name: photo.file_name })}
      data-arrange-item={photo.file_name}
    >
      <div className="relative aspect-square">
        {photo.signedUrl ? (
          <img src={photo.signedUrl} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium">
          {position}
        </span>
        <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/90">
          <GripVertical className="h-4 w-4" />
        </span>
      </div>
      <p className="truncate px-2 py-1.5 text-[11px] text-muted-foreground">{photo.file_name}</p>
    </li>
  );
}
