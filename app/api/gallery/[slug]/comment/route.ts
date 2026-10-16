import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { isSelectionOpen } from "@/lib/album-access";
import { guardGalleryRequest } from "@/lib/gallery-guard";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  photoId: z.string().uuid(),
  comment: z.string().trim().max(500),
  shareToken: z.string().max(100).nullish(),
});

/** Saves the client's note on one of their selected photos (empty clears it). */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return await apiError("invalidRequest", 400);
  const body = parsed.data;

  const guard = await guardGalleryRequest(slug, body.shareToken);
  if ("error" in guard) return guard.error;
  const { album, selectionKey, admin } = guard;

  if (!isSelectionOpen(album.status)) return await apiError("selectionLocked", 423);
  if (!(await rateLimit(`select:${album.id}:${selectionKey}`, 600, 10 * 60))) {
    return await apiError("tooManyRequests", 429);
  }

  const { data, error } = await admin
    .from("selections")
    .update({ comment: body.comment || null })
    .eq("album_id", album.id)
    .eq("photo_id", body.photoId)
    .eq("selection_key", selectionKey)
    .select("id");
  if (error) {
    console.error("comment save failed", error.message);
    return await apiError("saveFailed", 500);
  }
  if (!data?.length) return await apiError("notSelected", 404);

  return NextResponse.json({ ok: true, comment: body.comment || null });
}
