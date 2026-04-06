import crypto from "crypto";
import { cookies } from "next/headers";
import type { Album } from "@/lib/types";
import { env } from "@/lib/env";

export function getAlbumAccessCookieName(albumId: string) {
  return `album-access-${albumId}`;
}

export function getSelectionCookieName(albumId: string) {
  return `gallery-selection-${albumId}`;
}

function signAlbumToken(albumId: string) {
  return crypto
    .createHmac("sha256", env.albumCookieSecret)
    .update(albumId)
    .digest("hex");
}

export function createAlbumAccessCookieValue(albumId: string) {
  return `${albumId}.${signAlbumToken(albumId)}`;
}

export function verifyAlbumAccessCookieValue(albumId: string, value?: string | null) {
  if (!value) return false;
  const [rawAlbumId, signature] = value.split(".");
  if (rawAlbumId !== albumId || !signature) return false;

  const expected = signAlbumToken(albumId);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function hasAlbumPasswordAccess(albumId: string) {
  const cookieStore = await cookies();
  const value = cookieStore.get(getAlbumAccessCookieName(albumId))?.value;
  return verifyAlbumAccessCookieValue(albumId, value);
}

export async function canAccessAlbum(album: Album, shareToken?: string | null) {
  const passwordOk = album.password_hash ? await hasAlbumPasswordAccess(album.id) : true;

  if (album.visibility === "public") {
    return passwordOk;
  }

  const shareOk = !!shareToken && shareToken === album.share_token;
  return shareOk && passwordOk;
}

export function getSelectionKey(cookieValue?: string | null) {
  return cookieValue && cookieValue.trim().length > 0
    ? cookieValue
    : crypto.randomUUID();
}
