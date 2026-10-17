"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Link2, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteAlbum, resetShareLink, setAlbumArchived } from "@/app/dashboard/albums/actions";
import { copyText } from "@/lib/clipboard";

type ManagedAlbum = { id: string; title: string; photoCount: number };

/**
 * Change link / archive / restore / delete, with confirmations, shared by the
 * album cards and the album's "Manage" section. Render `dialogs` once.
 */
export function useAlbumManagement(album: ManagedAlbum, { afterDelete }: { afterDelete?: () => void } = {}) {
  const t = useTranslations("manage");
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"reset" | "delete" | null>(null);
  // Which action is running, so only that button shows a spinner.
  const [busy, setBusy] = useState<"reset" | "archive" | "delete" | null>(null);

  const archive = (archived: boolean) =>
    startTransition(async () => {
      setBusy("archive");
      const result = await setAlbumArchived(album.id, archived);
      setBusy(null);
      if (result.ok) toast.success(archived ? t("toast.archived") : t("toast.restored"));
      else toast.error(t("toast.error"));
    });

  const reset = () =>
    startTransition(async () => {
      setBusy("reset");
      const result = await resetShareLink(album.id);
      setBusy(null);
      if (!result.ok) {
        toast.error(t("toast.error"));
        return;
      }
      await copyText(new URL(result.sharePath, window.location.origin).toString());
      toast.success(t("toast.reset"));
    });

  const remove = () =>
    startTransition(async () => {
      setBusy("delete");
      const result = await deleteAlbum(album.id);
      if (!result.ok) setBusy(null);
      if (!result.ok) {
        toast.error(t("toast.error"));
        return;
      }
      toast.success(t("toast.deleted"));
      afterDelete?.();
    });

  const dialogs = (
    <>
      <ConfirmDialog
        open={confirm === "reset"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t("reset.title")}
        description={t("reset.body")}
        confirmLabel={t("reset.confirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          setConfirm(null);
          reset();
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t("delete.title", { title: album.title })}
        description={t("delete.body", { count: album.photoCount })}
        confirmLabel={t("delete.confirm")}
        cancelLabel={t("cancel")}
        destructive
        onConfirm={() => {
          setConfirm(null);
          remove();
        }}
      />
    </>
  );

  return {
    pending,
    busy,
    archive,
    requestReset: () => setConfirm("reset"),
    requestDelete: () => setConfirm("delete"),
    dialogs,
  };
}

/** "Manage album" section at the bottom of the album details page. */
export function AlbumManagePanel({ album, archived }: { album: ManagedAlbum; archived: boolean }) {
  const t = useTranslations("manage");
  const router = useRouter();
  const manage = useAlbumManagement(album, { afterDelete: () => router.push("/dashboard") });

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="manage-heading">
      <h2 id="manage-heading" className="font-semibold">
        {t("title")}
      </h2>
      <div className="mt-4 divide-y divide-border">
        <ManageRow title={t("reset.label")} hint={t("reset.hint")}>
          <Button variant="outline" size="sm" disabled={manage.pending} loading={manage.busy === "reset"} onClick={manage.requestReset}>
            <Link2 className="h-4 w-4" />
            {t("reset.label")}
          </Button>
        </ManageRow>
        <ManageRow title={archived ? t("restore") : t("archive")} hint={archived ? t("restoreHint") : t("archiveHint")}>
          <Button
            variant="outline"
            size="sm"
            disabled={manage.pending}
            loading={manage.busy === "archive"}
            onClick={() => manage.archive(!archived)}
          >
            {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {archived ? t("restore") : t("archive")}
          </Button>
        </ManageRow>
        <ManageRow title={t("delete.label")} hint={t("delete.hint")}>
          <Button variant="destructive" size="sm" disabled={manage.pending} loading={manage.busy === "delete"} onClick={manage.requestDelete}>
            <Trash2 className="h-4 w-4" />
            {t("delete.label")}
          </Button>
        </ManageRow>
      </div>
      {manage.dialogs}
    </section>
  );
}

function ManageRow({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
