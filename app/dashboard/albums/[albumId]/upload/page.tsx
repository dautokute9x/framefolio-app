import { notFound } from "next/navigation";
import { UploadManager } from "@/components/dashboard/upload-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminProfile } from "@/lib/auth";
import { getAlbumForOwner, getUploadPhotosForAlbum } from "@/lib/data";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const profile = await requireAdminProfile();
  const album = await getAlbumForOwner(albumId, profile.id);

  if (!album) notFound();

  const photos = await getUploadPhotosForAlbum(albumId, profile.id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-3xl">{album.title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Upload images directly to secure storage. Each successful upload is registered inside the photos table automatically.
          </p>
        </CardContent>
      </Card>

      <UploadManager ownerId={profile.id} albumId={albumId} initialPhotos={photos} />
    </div>
  );
}
