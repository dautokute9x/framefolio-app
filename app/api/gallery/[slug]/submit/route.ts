import { NextResponse, after } from "next/server";
import { apiError } from "@/lib/api-error";
import { z } from "zod";
import { isSelectionOpen } from "@/lib/album-access";
import { guardGalleryRequest } from "@/lib/gallery-guard";
import { notifySelectionSubmitted } from "@/lib/notify";
import { rateLimit, visitorKey } from "@/lib/rate-limit";
import { getSiteOrigin } from "@/lib/site-url";

const bodySchema = z.object({
  shareToken: z.string().max(100).nullish(),
  selectorName: z.string().trim().min(1).max(120),
  selectorEmail: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success),
  note: z.string().trim().max(2000).optional(),
});

/**
 * Client confirms ("chốt") the shortlist. The album moves to "Editing" so the
 * selection is locked; the photographer can reopen it by setting the status
 * back to "Client Selecting".
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return await apiError(
      field === "selectorName" ? "nameRequired" : field === "selectorEmail" ? "invalidEmail" : "invalidRequest",
      400
    );
  }
  const body = parsed.data;

  const guard = await guardGalleryRequest(slug, body.shareToken);
  if ("error" in guard) return guard.error;
  const { album, selectionKey, persistSelectionKey, admin } = guard;

  if (!isSelectionOpen(album.status)) {
    return await apiError("alreadySubmitted", 423);
  }
  if (!(await rateLimit(`submit:${album.id}:${await visitorKey()}`, 20, 60 * 60))) {
    return await apiError("tooManyRequests", 429);
  }

  const { count } = await admin
    .from("selections")
    .select("id", { head: true, count: "exact" })
    .eq("album_id", album.id)
    .eq("selection_key", selectionKey);

  if (!count) {
    return await apiError("nothingSelected", 400);
  }
  if (album.selection_limit && count > album.selection_limit) {
    return await apiError("overLimit", 409, { count, limit: album.selection_limit });
  }

  const submittedAt = new Date().toISOString();
  const { error } = await admin.from("selection_sessions").upsert(
    {
      album_id: album.id,
      selection_key: selectionKey,
      selector_name: body.selectorName,
      selector_email: body.selectorEmail || null,
      note: body.note || null,
      submitted_at: submittedAt,
    },
    { onConflict: "album_id,selection_key" }
  );
  if (error) {
    return await apiError("submitFailed", 500);
  }

  // Keep the name on every selection row as well (shown in older views/exports).
  await admin
    .from("selections")
    .update({ selector_name: body.selectorName, selector_email: body.selectorEmail || null })
    .eq("album_id", album.id)
    .eq("selection_key", selectionKey);

  await admin.from("albums").update({ status: "Editing" }).eq("id", album.id);
  persistSelectionKey();

  // Tell the photographer by email (optional, after the response is sent).
  const { origin } = await getSiteOrigin();
  after(() =>
    notifySelectionSubmitted({
      ownerId: album.owner_id,
      albumId: album.id,
      albumTitle: album.title,
      clientName: body.selectorName,
      note: body.note || null,
      count,
      origin,
    }).catch((err) => console.error("[notify] failed", err))
  );

  return NextResponse.json({ ok: true, count, submittedAt });
}
