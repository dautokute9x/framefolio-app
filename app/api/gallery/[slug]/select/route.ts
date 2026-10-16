import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { z } from "zod";
import { isSelectionOpen } from "@/lib/album-access";
import { guardGalleryRequest } from "@/lib/gallery-guard";

const bodySchema = z.object({
  photoId: z.string().uuid(),
  selected: z.boolean(),
  shareToken: z.string().max(100).nullish(),
  selectorName: z.string().trim().max(120).optional(),
  selectorEmail: z.string().trim().max(200).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return await apiError("invalidRequest", 400);
  }
  const body = parsed.data;

  const guard = await guardGalleryRequest(slug, body.shareToken);
  if ("error" in guard) return guard.error;
  const { album, selectionKey, persistSelectionKey, admin } = guard;

  if (!isSelectionOpen(album.status)) {
    return await apiError("selectionLocked", 423);
  }

  // The photo must belong to this album (previously any photo id was accepted).
  const { data: photo } = await admin
    .from("photos")
    .select("id")
    .eq("id", body.photoId)
    .eq("album_id", album.id)
    .eq("is_archived", false)
    .maybeSingle();

  if (!photo) {
    return await apiError("photoNotInAlbum", 404);
  }

  const countSelected = async () => {
    const { count } = await admin
      .from("selections")
      .select("id", { head: true, count: "exact" })
      .eq("album_id", album.id)
      .eq("selection_key", selectionKey);
    return count ?? 0;
  };

  const name = body.selectorName || null;
  const email = body.selectorEmail || null;

  if (body.selected) {
    const { error } = await admin.from("selections").upsert(
      {
        album_id: album.id,
        photo_id: body.photoId,
        selection_key: selectionKey,
        selector_name: name,
        selector_email: email,
      },
      { onConflict: "album_id,photo_id,selection_key" }
    );
    if (error) {
      return await apiError("saveFailed", 500);
    }

    // Enforce the package limit after the write so concurrent taps cannot overshoot it.
    if (album.selection_limit) {
      const count = await countSelected();
      if (count > album.selection_limit) {
        await admin
          .from("selections")
          .delete()
          .eq("album_id", album.id)
          .eq("photo_id", body.photoId)
          .eq("selection_key", selectionKey);
        persistSelectionKey();
        return await apiError("limitReached", 409, { limit: album.selection_limit });
      }
    }
  } else {
    await admin
      .from("selections")
      .delete()
      .eq("album_id", album.id)
      .eq("photo_id", body.photoId)
      .eq("selection_key", selectionKey);
  }

  // Keep one row per client device with their latest name/email.
  await admin.from("selection_sessions").upsert(
    {
      album_id: album.id,
      selection_key: selectionKey,
      ...(name ? { selector_name: name } : {}),
      ...(email ? { selector_email: email } : {}),
    },
    { onConflict: "album_id,selection_key" }
  );

  // First pick on a sent album moves the job to "Client Selecting".
  if (album.status === "Sent") {
    await admin.from("albums").update({ status: "Client Selecting" }).eq("id", album.id);
  }

  const count = await countSelected();
  persistSelectionKey();

  return NextResponse.json({ ok: true, count });
}
