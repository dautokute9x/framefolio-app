import crypto from "crypto";
import { cookies } from "next/headers";
import type { Album } from "@/lib/types";
import { serverEnv } from "@/lib/env.server";

export function getAlbumAccessCookieName(albumId: string) {
  return `album-access-${albumId}`;
}

export function getSelectionCookieName(albumId: string) {
  return `gallery-selection-${albumId}`;
}

// The password hash is part of the signed payload so that changing the
// gallery password invalidates every previously issued access cookie.
function signAlbumToken(albumId: string, passwordHash: string) {
  return crypto
    .createHmac("sha256", serverEnv.albumCookieSecret)
    .update(`${albumId}:${passwordHash}`)
    .digest("hex");
}

export function createAlbumAccessCookieValue(albumId: string, passwordHash: string) {
  return `${albumId}.${signAlbumToken(albumId, passwordHash)}`;
}

export function verifyAlbumAccessCookieValue(
  albumId: string,
  passwordHash: string,
  value?: string | null
) {
  if (!value) return false;
  const [rawAlbumId, signature] = value.split(".");
  if (rawAlbumId !== albumId || !signature) return false;

  const actual = Buffer.from(signature);
  const expected = Buffer.from(signAlbumToken(albumId, passwordHash));
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export async function hasAlbumPasswordAccess(albumId: string, passwordHash: string) {
  const cookieStore = await cookies();
  const value = cookieStore.get(getAlbumAccessCookieName(albumId))?.value;
  return verifyAlbumAccessCookieValue(albumId, passwordHash, value);
}

export async function canAccessAlbum(album: Album, shareToken?: string | null) {
  const passwordOk = album.password_hash
    ? await hasAlbumPasswordAccess(album.id, album.password_hash)
    : true;

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
