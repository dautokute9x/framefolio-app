import "server-only";
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

// The signature also covers the current password hash, so changing the
// gallery password immediately invalidates every previously unlocked device.
function signAlbumToken(albumId: string, passwordHash: string) {
  return crypto
    .createHmac("sha256", serverEnv.albumCookieSecret)
    .update(`${albumId}:${passwordHash}`)
    .digest("hex");
}

export function createAlbumAccessCookieValue(albumId: string, passwordHash: string) {
  return `${albumId}.${signAlbumToken(albumId, passwordHash)}`;
}

function verifyAlbumAccessCookieValue(
  albumId: string,
  passwordHash: string,
  value?: string | null
) {
  if (!value) return false;
  const [rawAlbumId, signature] = value.split(".");
  if (rawAlbumId !== albumId || !signature) return false;

  const expected = Buffer.from(signAlbumToken(albumId, passwordHash));
  const received = Buffer.from(signature);
  // timingSafeEqual throws when lengths differ (a tampered cookie used to
  // crash the page with a 500), so compare lengths first.
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(received, expected);
}

export async function hasAlbumPasswordAccess(album: Pick<Album, "id" | "password_hash">) {
  if (!album.password_hash) return true;
  const cookieStore = await cookies();
  const value = cookieStore.get(getAlbumAccessCookieName(album.id))?.value;
  return verifyAlbumAccessCookieValue(album.id, album.password_hash, value);
}

export function isShareTokenValid(
  album: Pick<Album, "visibility" | "share_token">,
  shareToken?: string | null
) {
  if (album.visibility === "public") return true;
  return !!shareToken && shareToken === album.share_token;
}


const SELECTION_KEY_PATTERN = /^[0-9a-f-]{36}$/i;

export function getSelectionKey(cookieValue?: string | null) {
  return cookieValue && SELECTION_KEY_PATTERN.test(cookieValue)
    ? cookieValue
    : crypto.randomUUID();
}

/** Album statuses in which the client may still change the selection. */
const SELECTION_OPEN_STATUSES = ["Draft", "Sent", "Client Selecting"] as const;

export function isSelectionOpen(status: string) {
  return (SELECTION_OPEN_STATUSES as readonly string[]).includes(status);
}
