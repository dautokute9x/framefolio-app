import { NextResponse } from "next/server";
import { z } from "zod";
import { isSelectionOpen } from "@/lib/album-access";
import { guardGalleryRequest } from "@/lib/gallery-guard";

const bodySchema = z.object({
  shareToken: z.string().max(100).nullish(),
  selectorName: z.string().trim().min(1, "Vui lòng nhập tên").max(120),
  selectorEmail: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success, "Email không hợp lệ"),
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Yêu cầu không hợp lệ" },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const guard = await guardGalleryRequest(slug, body.shareToken);
  if ("error" in guard) return guard.error;
  const { album, selectionKey, persistSelectionKey, admin } = guard;

  if (!isSelectionOpen(album.status)) {
    return NextResponse.json({ error: "Album đã được chốt trước đó." }, { status: 423 });
  }

  const { count } = await admin
    .from("selections")
    .select("id", { head: true, count: "exact" })
    .eq("album_id", album.id)
    .eq("selection_key", selectionKey);

  if (!count) {
    return NextResponse.json({ error: "Bạn chưa chọn ảnh nào." }, { status: 400 });
  }
  if (album.selection_limit && count > album.selection_limit) {
    return NextResponse.json(
      { error: `Bạn đang chọn ${count} ảnh, vượt giới hạn ${album.selection_limit} ảnh.` },
      { status: 409 }
    );
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
    return NextResponse.json({ error: "Không gửi được, vui lòng thử lại" }, { status: 500 });
  }

  // Keep the name on every selection row as well (shown in older views/exports).
  await admin
    .from("selections")
    .update({ selector_name: body.selectorName, selector_email: body.selectorEmail || null })
    .eq("album_id", album.id)
    .eq("selection_key", selectionKey);

  await admin.from("albums").update({ status: "Editing" }).eq("id", album.id);
  persistSelectionKey();

  return NextResponse.json({ ok: true, count, submittedAt });
}
