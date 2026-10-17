"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { AlbumStatusBadge } from "@/components/album-status-badge";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteClient, saveClient, type ClientInput } from "@/app/dashboard/clients/actions";
import type { Album, Client } from "@/lib/types";

type Row = Client & { albums: Pick<Album, "id" | "title" | "status" | "event_date">[] };

export function ClientList({ clients }: { clients: Row[] }) {
  const t = useTranslations("clients");
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      {adding ? (
        <ClientForm onDone={() => setAdding(false)} />
      ) : (
        <Button type="button" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          {t("add")}
        </Button>
      )}

      {clients.length === 0 && !adding ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : null}

      <ul className="space-y-3">
        {clients.map((client) => (
          <ClientCard key={client.id} client={client} />
        ))}
      </ul>
    </div>
  );
}

function ClientCard({ client }: { client: Row }) {
  const t = useTranslations("clients");
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <li>
        <ClientForm client={client} onDone={() => setEditing(false)} />
      </li>
    );
  }

  const remove = () =>
    startTransition(async () => {
      const result = await deleteClient(client.id);
      if (result.ok) toast.success(t("toast.deleted"));
      else toast.error("reason" in result && result.reason === "hasAlbums" ? t("deleteBlocked") : t("toast.error"));
    });

  return (
    <li className="rounded-2xl border border-border bg-card p-4 sm:p-5" data-client-card={client.name}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{client.name}</h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {client.phone ? (
              <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="h-3.5 w-3.5" />
                {client.phone}
              </a>
            ) : null}
            {client.email ? (
              <a href={`mailto:${client.email}`} className="inline-flex min-w-0 items-center gap-1 hover:text-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{client.email}</span>
              </a>
            ) : null}
          </div>
          {client.notes ? <p className="mt-2 whitespace-pre-line text-sm">{client.notes}</p> : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label={t("edit")} onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("delete")}
            title={client.albums.length ? t("deleteBlocked") : t("delete")}
            disabled={client.albums.length > 0}
            loading={pending}
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">{t("albums", { count: client.albums.length })}</p>
        {client.albums.length ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {client.albums.map((album) => (
              <li key={album.id}>
                <Link
                  href={`/dashboard/albums/${album.id}/upload`}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-secondary"
                >
                  <span className="max-w-[12rem] truncate">{album.title}</span>
                  <AlbumStatusBadge status={album.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirmDelete.title", { name: client.name })}
        description={t("confirmDelete.body")}
        confirmLabel={t("confirmDelete.confirm")}
        cancelLabel={t("cancel")}
        destructive
        onConfirm={() => {
          setConfirming(false);
          remove();
        }}
      />
    </li>
  );
}

function ClientForm({ client, onDone }: { client?: Client; onDone: () => void }) {
  const t = useTranslations("clients");
  const [pending, startTransition] = useTransition();
  const prefix = client?.id ?? "new";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: ClientInput = {
      id: client?.id,
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      notes: String(form.get("notes") ?? ""),
    };
    if (!input.name.trim()) {
      toast.error(t("toast.nameRequired"));
      return;
    }
    startTransition(async () => {
      const result = await saveClient(input);
      if (result.ok) {
        toast.success(t("toast.saved"));
        onDone();
      } else toast.error(t("toast.error"));
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 sm:p-5">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${prefix}-name`}>{t("name")}</Label>
        <Input id={`${prefix}-name`} name="name" defaultValue={client?.name ?? ""} required autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-phone`}>{t("phone")}</Label>
        <Input id={`${prefix}-phone`} name="phone" type="tel" defaultValue={client?.phone ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-email`}>{t("email")}</Label>
        <Input id={`${prefix}-email`} name="email" type="email" defaultValue={client?.email ?? ""} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${prefix}-notes`}>{t("notes")}</Label>
        <Textarea id={`${prefix}-notes`} name="notes" rows={2} defaultValue={client?.notes ?? ""} />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          {t("cancel")}
        </Button>
        <Button type="submit" loading={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
