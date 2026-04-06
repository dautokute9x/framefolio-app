import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAlbumAccessCookieName,
  getSelectionCookieName,
  getSelectionKey,
  verifyAlbumAccessCookieValue,
} from "@/lib/album-access";
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

  if (body.albumId !== album.id) {
    return NextResponse.json({ error: "Album mismatch" }, { status: 400 });
  }

  if (album.visibility === "private" && body.shareToken !== album.share_token) {
    return NextResponse.json({ error: "Invalid share token" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const albumAccess = cookieStore.get(getAlbumAccessCookieName(album.id))?.value ?? null;

  if (album.password_hash && !verifyAlbumAccessCookieValue(album.id, albumAccess)) {
    return NextResponse.json({ error: "Password access required" }, { status: 403 });
  }

  const selectionCookieName = getSelectionCookieName(album.id);
  const existingSelectionKey = cookieStore.get(selectionCookieName)?.value ?? null;
  const selectionKey = getSelectionKey(existingSelectionKey);

  if (body.selected) {
    await admin.from("selections").upsert(
      {
        album_id: album.id,
        photo_id: body.photoId,
        selection_key: selectionKey,
        selector_name: String(body.selectorName ?? "").trim() || null,
        selector_email: String(body.selectorEmail ?? "").trim() || null,
      },
      {
        onConflict: "album_id,photo_id,selection_key",
      }
    );
  } else {
    await admin
      .from("selections")
      .delete()
      .eq("album_id", album.id)
      .eq("photo_id", body.photoId)
      .eq("selection_key", selectionKey);
  }

  const { count } = await admin
    .from("selections")
    .select("*", { head: true, count: "exact" })
    .eq("album_id", album.id)
    .eq("selection_key", selectionKey);

  cookieStore.set(selectionCookieName, selectionKey, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true, selectionKey, count: count ?? 0 });
}
