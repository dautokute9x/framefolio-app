import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAlbumAccessCookieValue, getAlbumAccessCookieName } from "@/lib/album-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = await request.json();
  const admin = createAdminClient();

  const { data: album } = await admin
    .from("albums")
    .select("id, visibility, share_token, password_hash")
    .eq("slug", slug)
    .maybeSingle();

  if (!album) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  if (album.visibility === "private" && body.shareToken !== album.share_token) {
    return NextResponse.json({ error: "Invalid share token" }, { status: 403 });
  }

  if (!album.password_hash) {
    return NextResponse.json({ ok: true });
  }

  const valid = await bcrypt.compare(String(body.password ?? ""), album.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(getAlbumAccessCookieName(album.id), createAlbumAccessCookieValue(album.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return NextResponse.json({ ok: true });
}
