import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHOTO_BUCKET } from "@/lib/constants";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await params;
  const profile = await requireAdminProfile();
  const supabase = await createClient();
  const admin = createAdminClient();
  const body = await request.json();

  const { data: album } = await supabase
    .from("albums")
    .select("id, cover_photo_id")
    .eq("id", albumId)
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (!album) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  const { data: inserted, error } = await supabase
    .from("photos")
    .insert({
      album_id: albumId,
      owner_id: profile.id,
      file_path: body.filePath,
      file_name: body.fileName,
      storage_bucket: PHOTO_BUCKET,
      width: body.width ?? null,
      height: body.height ?? null,
      sort_order: body.sortOrder ?? 0,
    })
    .select("*")
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? "Unable to register photo" }, { status: 400 });
  }

  if (!album.cover_photo_id) {
    await supabase.from("albums").update({ cover_photo_id: inserted.id }).eq("id", albumId);
  }

  const { data: signed } = await admin.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(inserted.file_path, 60 * 60);

  return NextResponse.json({
    photo: {
      ...inserted,
      signedUrl: signed?.signedUrl ?? null,
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await params;
  const profile = await requireAdminProfile();
  const supabase = await createClient();
  const body = await request.json();

  const { data: photo } = await supabase
    .from("photos")
    .select("*")
    .eq("id", body.photoId)
    .eq("album_id", albumId)
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  await supabase.from("photos").delete().eq("id", photo.id);
  const admin = createAdminClient();
  await admin.storage.from(PHOTO_BUCKET).remove([body.filePath]);

  const { data: album } = await supabase.from("albums").select("cover_photo_id").eq("id", albumId).single();
  if (album?.cover_photo_id === photo.id) {
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
