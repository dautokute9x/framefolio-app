import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { activeDriver, bucketValueForDriver, removeObjects, signReadUrls } from "@/lib/storage";

const postSchema = z.object({
  filePath: z.string().min(1).max(500),
  previewPath: z.string().min(1).max(500).nullish(),
  fileName: z.string().min(1).max(255),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
});

const deleteSchema = z.object({ photoId: z.string().uuid() });

const unauthorized = () =>
  NextResponse.json({ error: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại" }, { status: 401 });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await params;
  // API routes must answer JSON; `requireAdminProfile()` redirects to an HTML page,
  // which made `response.json()` throw in the upload UI when the session expired.
  const profile = await getCurrentProfile();
  if (!profile) return unauthorized();

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu ảnh không hợp lệ" }, { status: 400 });
  }
  const body = parsed.data;

  // Paths must live inside this photographer's album folder.
  const prefix = `${profile.id}/${albumId}/`;
  if (!body.filePath.startsWith(prefix) || (body.previewPath && !body.previewPath.startsWith(prefix))) {
    return NextResponse.json({ error: "Đường dẫn ảnh không hợp lệ" }, { status: 400 });
  }

  const supabase = await createClient();
  const storageBucket = bucketValueForDriver(activeDriver());

  const { data: album } = await supabase
    .from("albums")
    .select("id, cover_photo_id")
    .eq("id", albumId)
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (!album) {
    return NextResponse.json({ error: "Không tìm thấy album" }, { status: 404 });
  }

  const { data: inserted, error } = await supabase
    .from("photos")
    .insert({
      album_id: albumId,
      owner_id: profile.id,
      file_path: body.filePath,
      preview_path: body.previewPath ?? null,
      file_name: body.fileName,
      storage_bucket: storageBucket,
      width: body.width ?? null,
      height: body.height ?? null,
      // sort_order is assigned by the `assign_photo_sort_order` trigger
      // (migration 0002) under a per-album lock, so parallel uploads never collide.
      sort_order: 0,
    })
    .select("*")
    .single();

  if (error || !inserted) {
    // Do not leave orphaned files in storage when registration fails.
    await removeObjects(
      [body.filePath, ...(body.previewPath ? [body.previewPath] : [])],
      storageBucket
    ).catch(() => undefined);
    return NextResponse.json({ error: error?.message ?? "Không lưu được ảnh" }, { status: 400 });
  }

  if (!album.cover_photo_id) {
    await supabase.from("albums").update({ cover_photo_id: inserted.id }).eq("id", albumId);
  }

  const previewPath = inserted.preview_path ?? inserted.file_path;
  const signed = await signReadUrls([{ path: previewPath, storageBucket }], 60 * 60 * 6);

  return NextResponse.json({
    photo: {
      ...inserted,
      signedUrl: signed.get(previewPath) ?? null,
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return unauthorized();

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("photos")
    .select("*")
    .eq("id", parsed.data.photoId)
    .eq("album_id", albumId)
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (!photo) {
    return NextResponse.json({ error: "Không tìm thấy ảnh" }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("photos").delete().eq("id", photo.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  // Only ever delete the paths recorded in the database for this photo. The old
  // code deleted whatever `filePath` the request body contained, using the
  // service role, i.e. any file in the bucket.
  await removeObjects(
    [photo.file_path, ...(photo.preview_path ? [photo.preview_path] : [])],
    photo.storage_bucket
  ).catch((error) => console.error("[storage] delete failed", error));

  const { data: album } = await supabase.from("albums").select("cover_photo_id").eq("id", albumId).single();
  if (!album?.cover_photo_id) {
    const { data: nextPhoto } = await supabase
      .from("photos")
      .select("id")
      .eq("album_id", albumId)
      .eq("owner_id", profile.id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    await supabase.from("albums").update({ cover_photo_id: nextPhoto?.id ?? null }).eq("id", albumId);
  }

  return NextResponse.json({ ok: true });
}
