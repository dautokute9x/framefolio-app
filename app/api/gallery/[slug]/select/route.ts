import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAlbumAccessCookieName,
  getSelectionCookieName,
  getSelectionKey,
  verifyAlbumAccessCookieValue,
} from "@/lib/album-access";
import { readJsonBody } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

type GalleryAlbum = {
  id: string;
  visibility: "public" | "private";
  share_token: string | null;
  password_hash: string | null;
};

const selectSchema = z.object({
  albumId: z.string().uuid(),
  photoId: z.string().uuid(),
  selected: z.boolean(),
  selectorName: z.string().max(200).nullish(),
  selectorEmail: z.string().max(320).nullish(),
  shareToken: z.string().max(100).nullish(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const parsed = selectSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;
  const admin = createAdminClient();

  const result = await admin
    .from("albums")
    .select("id, visibility, share_token, password_hash")
    .eq("slug", slug)
    .maybeSingle();

  const album = result.data as GalleryAlbum | null;

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
  const albumAccess =
    cookieStore.get(getAlbumAccessCookieName(album.id))?.value ?? null;

  if (
    album.password_hash &&
    !verifyAlbumAccessCookieValue(album.id, album.password_hash, albumAccess)
  ) {
    return NextResponse.json(
      { error: "Password access required" },
      { status: 403 }
    );
  }

  const { data: photo } = await admin
    .from("photos")
    .select("id")
    .eq("id", body.photoId)
    .eq("album_id", album.id)
    .eq("is_archived", false)
    .maybeSingle();

  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const selectionCookieName = getSelectionCookieName(album.id);
  const existingSelectionKey =
    cookieStore.get(selectionCookieName)?.value ?? null;
  const selectionKey = getSelectionKey(existingSelectionKey);

  const { error: writeError } = body.selected
    ? await admin.from("selections").upsert(
        {
          album_id: album.id,
          photo_id: body.photoId,
          selection_key: selectionKey,
          selector_name: (body.selectorName ?? "").trim() || null,
          selector_email: (body.selectorEmail ?? "").trim() || null,
        } as any,
        {
          onConflict: "album_id,photo_id,selection_key",
        }
      )
    : await admin
        .from("selections")
        .delete()
        .eq("album_id", album.id)
        .eq("photo_id", body.photoId)
        .eq("selection_key", selectionKey);

  if (writeError) {
    return NextResponse.json(
      { error: "Unable to save selection" },
      { status: 500 }
    );
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
