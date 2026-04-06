import Image from "next/image";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminProfile } from "@/lib/auth";
import { getAlbumSelectionReview } from "@/lib/data";
import { formatDateTime } from "@/lib/utils";

export default async function SelectionResultsPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const profile = await requireAdminProfile();
  const review = await getAlbumSelectionReview(albumId, profile.id);

  if (!review) notFound();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-3xl">{review.album.title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Selection review for {review.album.clients?.name ?? "client"}.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {review.selections.map((selection) => (
          <Card key={selection.id} className="overflow-hidden">
            <div className="grid md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="relative aspect-[4/5] bg-secondary">
                {selection.photos?.signedUrl ? (
                  <Image src={selection.photos.signedUrl} alt={selection.photos.file_name} fill className="object-cover" />
                ) : null}
              </div>
              <CardContent className="space-y-2 p-5">
                <p className="text-sm font-medium">{selection.photos.file_name}</p>
                <p className="text-sm text-muted-foreground">
                  Selected by {selection.selector_name || "Anonymous"} {selection.selector_email ? `(${selection.selector_email})` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Session key: {selection.selection_key}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(selection.created_at)}
                </p>
              </CardContent>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
