import "server-only";
import { cookies } from "next/headers";
import { apiError } from "@/lib/api-error";
import {
  albumAvailability,
  getSelectionCookieName,
  getSelectionKey,
  hasAlbumPasswordAccess,
  isShareTokenValid,
} from "@/lib/album-access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Album } from "@/lib/types";

export type GuardedAlbum = Pick<
  Album,
  | "id"
  | "owner_id"
  | "title"
  | "visibility"
  | "share_token"
  | "password_hash"
  | "status"
  | "selection_limit"
  | "archived_at"
  | "expires_at"
  | "allow_download"
>;

/**
 * Shared access check for the client-facing gallery API routes.
 * Returns either the album + the visitor's selection key, or an error response.
 */
export async function guardGalleryRequest(slug: string, shareToken?: string | null) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("albums")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  const album = data as GuardedAlbum | null;

  if (!album || !isShareTokenValid(album, shareToken) || albumAvailability(album) === "archived") {
    return { error: await apiError("albumNotFound", 404) } as const;
  }
  if (albumAvailability(album) === "expired") {
    return { error: await apiError("albumExpired", 410) } as const;
  }

  if (!(await hasAlbumPasswordAccess(album))) {
    return {
      error: await apiError("passwordRequired", 403),
    } as const;
  }

  const cookieStore = await cookies();
  const cookieName = getSelectionCookieName(album.id);
  const selectionKey = getSelectionKey(cookieStore.get(cookieName)?.value ?? null);

  const persistSelectionKey = () =>
    cookieStore.set(cookieName, selectionKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });

  return { album, selectionKey, persistSelectionKey, admin } as const;
}
