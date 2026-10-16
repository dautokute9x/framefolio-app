import { getTranslations } from "next-intl/server";
import { Globe, Lock } from "lucide-react";
import { STATUS_KEY } from "@/components/album-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { JOB_STATUSES } from "@/lib/constants";
import type { Album, Client } from "@/lib/types";

/** "2026-10-20T16:59:59Z" → "2026-10-20" as seen in Vietnam, for a date input. */
function toVietnamDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ id, label, hint, full, children }: { id: string; label: string; hint?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export async function AlbumEditorForm({
  action,
  album,
  clients,
  error,
}: {
  action: (formData: FormData) => Promise<void>;
  album?: (Album & { clients?: Client | null }) | null;
  clients: Client[];
  error?: string;
}) {
  const [t, tStatus] = await Promise.all([getTranslations("albumForm"), getTranslations("status")]);
  const visibility = album?.visibility ?? "private";

  return (
    <form action={action} className="space-y-5 pb-24 md:pb-0">
      {album ? <input type="hidden" name="albumId" value={album.id} /> : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error === "title" ? t("errors.title") : t("errors.save")}
        </p>
      ) : null}

      <Section title={t("sections.info")}>
        <Field id="title" label={t("title")} full>
          <Input id="title" name="title" defaultValue={album?.title ?? ""} placeholder={t("titlePlaceholder")} required />
        </Field>
        <Field id="eventDate" label={t("eventDate")}>
          <Input id="eventDate" name="eventDate" type="date" defaultValue={album?.event_date ?? ""} />
        </Field>
        {album ? (
          <Field id="slug" label={t("address")} hint={t("addressHint")}>
            <p id="slug" className="flex h-11 items-center truncate rounded-xl border border-dashed border-input px-3 text-sm text-muted-foreground">
              /gallery/{album.slug}
            </p>
          </Field>
        ) : null}
        <Field id="description" label={t("description")} full>
          <Textarea id="description" name="description" defaultValue={album?.description ?? ""} rows={3} />
        </Field>
      </Section>

      <Section title={t("sections.client")} hint={t("clientHint")}>
        <Field id="clientId" label={t("existingClient")} full>
          <Select id="clientId" name="clientId" defaultValue={album?.client_id ?? ""}>
            <option value="">{t("newClientOption")}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="clientName" label={t("clientName")}>
          <Input id="clientName" name="clientName" defaultValue={album?.clients?.name ?? ""} />
        </Field>
        <Field id="clientPhone" label={t("clientPhone")}>
          <Input id="clientPhone" name="clientPhone" type="tel" defaultValue={album?.clients?.phone ?? ""} />
        </Field>
        <Field id="clientEmail" label={t("clientEmail")}>
          <Input id="clientEmail" name="clientEmail" type="email" defaultValue={album?.clients?.email ?? ""} />
        </Field>
        <Field id="clientNotes" label={t("clientNotes")}>
          <Input id="clientNotes" name="clientNotes" defaultValue={album?.clients?.notes ?? ""} />
        </Field>
      </Section>

      <Section title={t("sections.access")}>
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium">{t("visibility")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["private", "public"] as const).map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary"
              >
                <input type="radio" name="visibility" value={value} defaultChecked={visibility === value} className="mt-1 h-4 w-4 accent-[hsl(222_32%_18%)]" />
                <span>
                  <span className="flex items-center gap-1.5 font-medium">
                    {value === "private" ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    {t(`visibilityOptions.${value}.label`)}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{t(`visibilityOptions.${value}.hint`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="galleryPassword" label={t("password")} hint={album?.password_hash ? t("passwordSetHint") : t("passwordHint")}>
          <Input id="galleryPassword" name="galleryPassword" type="text" autoComplete="off" defaultValue="" />
          {album?.password_hash ? (
            <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="removePassword" className="h-4 w-4" />
              {t("removePassword")}
            </label>
          ) : null}
        </Field>
        <Field id="selectionLimit" label={t("selectionLimit")} hint={t("selectionLimitHint")}>
          <Input id="selectionLimit" name="selectionLimit" type="number" min={1} inputMode="numeric" defaultValue={album?.selection_limit ?? ""} />
        </Field>
        <Field id="expiresOn" label={t("expiresOn")} hint={t("expiresOnHint")}>
          <Input id="expiresOn" name="expiresOn" type="date" defaultValue={toVietnamDate(album?.expires_at)} />
        </Field>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 rounded-xl border border-border p-4">
            <input type="checkbox" name="allowDownload" defaultChecked={album?.allow_download === true} className="mt-0.5 h-4 w-4" />
            <span>
              <span className="block text-sm font-medium">{t("allowDownload")}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t("allowDownloadHint")}</span>
            </span>
          </label>
        </div>
      </Section>

      {album ? (
        <Section title={t("sections.status")} hint={t("statusHint")}>
          <Field id="status" label={t("status")}>
            <Select id="status" name="status" defaultValue={album.status}>
              {JOB_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {tStatus(STATUS_KEY[status])}
                </option>
              ))}
            </Select>
          </Field>
        </Section>
      ) : (
        <input type="hidden" name="status" value="Draft" />
      )}

      <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-6xl justify-end">
          <Button type="submit" size="lg" className="w-full md:w-auto">
            {album ? t("save") : t("create")}
          </Button>
        </div>
      </div>
    </form>
  );
}
