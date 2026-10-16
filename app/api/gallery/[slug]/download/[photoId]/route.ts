import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { guardGalleryRequest } from "@/lib/gallery-guard";
import { rateLimit, visitorKey } from "@/lib/rate-limit";
import { signDownloadUrl } from "@/lib/storage";

/** Sends the client to a 5-minute download link for the original, when the album allows it. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; photoId: string }> }
) {
  const { slug, photoId } = await params;
  const shareToken = new URL(request.url).searchParams.get("share");
  if (!/^[0-9a-f-]{36}$/i.test(photoId)) return await apiError("invalidRequest", 400);

  const guard = await guardGalleryRequest(slug, shareToken);
  if ("error" in guard) return guard.error;
  const { album, admin } = guard;
  if (!album.allow_download) return await apiError("downloadDisabled", 403);
  if (!(await rateLimit(`download:${album.id}:${await visitorKey()}`, 300, 60 * 60))) {
    return await apiError("tooManyRequests", 429);
  }

  const { data: photo } = await admin
    .from("photos")
    .select("file_path, file_name, storage_bucket")
    .eq("id", photoId)
    .eq("album_id", album.id)
    .eq("is_archived", false)
    .maybeSingle();
  if (!photo) return await apiError("photoNotFound", 404);

  const url = await signDownloadUrl(photo.file_path, photo.storage_bucket, photo.file_name);
  if (!url) return await apiError("saveFailed", 500);
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
