import { notFound } from "next/navigation";
import { AlbumEditorForm } from "@/components/dashboard/album-editor-form";
import { requireAdminProfile } from "@/lib/auth";
import { getAlbumForOwner, getOwnerClients } from "@/lib/data";
import { updateAlbumAction } from "@/app/dashboard/albums/actions";

export default async function EditAlbumPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const profile = await requireAdminProfile();
  const [album, clients] = await Promise.all([
    getAlbumForOwner(albumId, profile.id),
    getOwnerClients(profile.id),
  ]);

  if (!album) notFound();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Edit</p>
        <h1 className="mt-2 font-display text-4xl">{album.title}</h1>
      </div>
      <AlbumEditorForm action={updateAlbumAction} album={album} clients={clients} submitLabel="Save changes" />
    </div>
  );
}
