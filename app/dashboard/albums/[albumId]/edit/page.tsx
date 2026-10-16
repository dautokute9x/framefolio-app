import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AlbumEditorForm } from "@/components/dashboard/album-editor-form";
import { AlbumTabs } from "@/components/dashboard/album-tabs";
import { requireAdminProfile } from "@/lib/auth";
import { AlbumManagePanel } from "@/components/dashboard/album-manage";
import { getAlbumForOwner, getAlbumPhotoCount, getOwnerClients } from "@/lib/data";
import { updateAlbumAction } from "@/app/dashboard/albums/actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("albumForm");
  return { title: t("editTitle") };
}

export default async function EditAlbumPage({
  params,
  searchParams,
}: {
  params: Promise<{ albumId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ albumId }, { error }] = await Promise.all([params, searchParams]);
  const profile = await requireAdminProfile();
  const [album, clients, photoCount] = await Promise.all([
    getAlbumForOwner(albumId, profile.id),
    getOwnerClients(profile.id),
    getAlbumPhotoCount(albumId),
  ]);
  if (!album) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <AlbumTabs album={album} active="edit" />
      <AlbumEditorForm action={updateAlbumAction} album={album} clients={clients} error={error} />
      <AlbumManagePanel album={{ id: album.id, title: album.title, photoCount }} archived={!!album.archived_at} />
    </div>
  );
}
