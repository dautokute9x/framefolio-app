import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { JOB_STATUSES } from "@/lib/constants";
import type { Album, Client } from "@/lib/types";

export function AlbumEditorForm({
  action,
  album,
  clients,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  album?: (Album & { clients?: Client | null }) | null;
  clients: Client[];
  submitLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{album ? "Edit album" : "Create album"}</CardTitle>
        <CardDescription>
          Manage a client job, control access, and generate a share-ready gallery link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-6 lg:grid-cols-2">
          {album ? <input type="hidden" name="albumId" value={album.id} /> : null}

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="title">Album title</Label>
            <Input id="title" name="title" defaultValue={album?.title ?? ""} required />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={album?.description ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Job status</Label>
            <select
              id="status"
              name="status"
              defaultValue={album?.status ?? "Draft"}
              className="flex h-10 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
            >
              {JOB_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility</Label>
            <select
              id="visibility"
              name="visibility"
              defaultValue={album?.visibility ?? "private"}
              className="flex h-10 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eventDate">Event date</Label>
            <Input id="eventDate" name="eventDate" type="date" defaultValue={album?.event_date ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="galleryPassword">Optional gallery password</Label>
            <Input
              id="galleryPassword"
              name="galleryPassword"
              type="text"
              defaultValue=""
              placeholder={album?.password_hash ? "Password already set. Type new one to replace." : "Leave blank for none"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientId">Choose existing client</Label>
            <select
              id="clientId"
              name="clientId"
              defaultValue={album?.client_id ?? ""}
              className="flex h-10 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
            >
              <option value="">Create / update from fields below</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientName">Client name</Label>
            <Input id="clientName" name="clientName" defaultValue={album?.clients?.name ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientEmail">Client email</Label>
            <Input id="clientEmail" name="clientEmail" type="email" defaultValue={album?.clients?.email ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientPhone">Client phone</Label>
            <Input id="clientPhone" name="clientPhone" defaultValue={album?.clients?.phone ?? ""} />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="clientNotes">Client notes</Label>
            <Textarea id="clientNotes" name="clientNotes" defaultValue={album?.clients?.notes ?? ""} />
          </div>

          <div className="lg:col-span-2 flex items-center justify-end">
            <Button type="submit" size="lg">{submitLabel}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
