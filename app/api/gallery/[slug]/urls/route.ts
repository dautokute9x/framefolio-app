import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { signGalleryPhotos } from "@/lib/data";
import { guardGalleryRequest } from "@/lib/gallery-guard";

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  shareToken: z.string().max(100).nullish(),
});

/** Signed preview URLs for the photos the client is about to see (same access rules as the page). */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return await apiError("invalidRequest", 400);

  const guard = await guardGalleryRequest(slug, parsed.data.shareToken);
  if ("error" in guard) return guard.error;

  const urls = await signGalleryPhotos(guard.album.id, [...new Set(parsed.data.ids)]);
  return NextResponse.json({ urls }, { headers: { "Cache-Control": "private, no-store" } });
}
