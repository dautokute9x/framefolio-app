import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { activeDriver, createR2UploadUrl } from "@/lib/storage";
import { makeStoragePathSegment } from "@/lib/utils";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const bodySchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(ACCEPTED_TYPES),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
  previewSize: z.number().int().positive().max(MAX_FILE_BYTES).nullish(),
});

/**
 * Hands the browser the storage paths for one photo (+ its preview) and, when
 * STORAGE_DRIVER=r2, short-lived presigned PUT URLs. Paths are always built
 * here, inside the photographer's own album folder.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Chỉ nhận JPG, PNG, WEBP tối đa 50MB" },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const supabase = await createClient();
  const { data: album } = await supabase
    .from("albums")
    .select("id")
    .eq("id", albumId)
    .eq("owner_id", profile.id)
    .maybeSingle();
  if (!album) {
    return NextResponse.json({ error: "Không tìm thấy album" }, { status: 404 });
  }

  const ext = (body.fileName.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const base = makeStoragePathSegment(body.fileName.replace(/\.[^.]+$/, "")).slice(0, 80);
  const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${base}`;
  const filePath = `${profile.id}/${albumId}/${unique}.${ext}`;
  const previewPath = body.previewSize ? `${profile.id}/${albumId}/previews/${unique}.jpg` : null;

  const driver = activeDriver();
  if (driver === "supabase") {
    // The browser uploads with supabase-js; storage RLS restricts it to this folder.
    return NextResponse.json({ driver, filePath, previewPath });
  }

  const [uploadUrl, previewUploadUrl] = await Promise.all([
    createR2UploadUrl(filePath, body.contentType, body.size),
    previewPath && body.previewSize
      ? createR2UploadUrl(previewPath, "image/jpeg", body.previewSize)
      : Promise.resolve(null),
  ]);

  return NextResponse.json({ driver, filePath, previewPath, uploadUrl, previewUploadUrl });
}
