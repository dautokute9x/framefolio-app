import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AlbumTabs } from "@/components/dashboard/album-tabs";
import { UploadManager } from "@/components/dashboard/upload-manager";
import { requireAdminProfile } from "@/lib/auth";
import { getAlbumForOwner, getUploadPhotosForAlbum } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("album.tabs");
  return { title: t("upload") };
}

export default async function UploadPage({ params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  const profile = await requireAdminProfile();
  const album = await getAlbumForOwner(albumId, profile.id);
  if (!album) notFound();

  const photos = await getUploadPhotosForAlbum(albumId, profile.id);

  return (
    <div className="space-y-6">
      <AlbumTabs album={album} active="upload" />
      <UploadManager albumId={albumId} initialPhotos={photos} />
    </div>
  );
}
