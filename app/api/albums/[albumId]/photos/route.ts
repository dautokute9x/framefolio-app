import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { readJsonBody } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHOTO_BUCKET } from "@/lib/constants";

const registerSchema = z.object({
  filePath: z.string().min(1).max(1024),
  fileName: z.string().min(1).max(500),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
  sortOrder: z.number().int().nullish(),
});

const deleteSchema = z.object({
  photoId: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = registerSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;

  // Only allow registering files uploaded into this owner's album folder.
  const expectedPrefix = `${profile.id}/${albumId}/`;
  if (!body.filePath.startsWith(expectedPrefix) || body.filePath.includes("..")) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = createAdminClient();

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
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = deleteSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
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
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("photos").delete().eq("id", photo.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Remove the file recorded in the database, never a path supplied by the client.
  const admin = createAdminClient();
  await admin.storage.from(PHOTO_BUCKET).remove([photo.file_path]);

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
