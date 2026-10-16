import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { z } from "zod";
import {
  createAlbumAccessCookieValue,
  getAlbumAccessCookieName,
  isShareTokenValid,
} from "@/lib/album-access";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  password: z.string().max(200).default(""),
  shareToken: z.string().max(100).nullish(),
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
  const admin = createAdminClient();

  const { data: album } = await admin
    .from("albums")
    .select("id, visibility, share_token, password_hash")
    .eq("slug", slug)
    .maybeSingle();

  if (!album || !isShareTokenValid(album, body.shareToken)) {
    return await apiError("albumNotFound", 404);
  }

  if (!album.password_hash) {
    return NextResponse.json({ ok: true });
  }

  const valid = await bcrypt.compare(body.password, album.password_hash);
  if (!valid) {
    // Small fixed delay slows down password guessing.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return await apiError("wrongPassword", 401);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    getAlbumAccessCookieName(album.id),
    createAlbumAccessCookieValue(album.id, album.password_hash),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    }
  );

  return NextResponse.json({ ok: true });
}
