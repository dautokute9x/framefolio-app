import { AlbumEditorForm } from "@/components/dashboard/album-editor-form";
import { requireAdminProfile } from "@/lib/auth";
import { getOwnerClients } from "@/lib/data";
import { createAlbumAction } from "@/app/dashboard/albums/actions";

export default async function NewAlbumPage() {
  const profile = await requireAdminProfile();
  const clients = await getOwnerClients(profile.id);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Create</p>
        <h1 className="mt-2 font-display text-4xl">New album</h1>
      </div>
      <AlbumEditorForm action={createAlbumAction} clients={clients} submitLabel="Create album" />
    </div>
  );
}
