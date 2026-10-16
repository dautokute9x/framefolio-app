 "use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminProfile } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { JOB_STATUSES } from "@/lib/constants";
import { removeObjects } from "@/lib/storage";
import type { JobStatus } from "@/lib/types";

function parseStatus(value: string): JobStatus {
  if (JOB_STATUSES.includes(value as JobStatus)) return value as JobStatus;
  return "Draft";
}

async function ensureUniqueSlug(baseSlug: string, albumId?: string) {
  // Slugs are globally unique, but RLS only shows this photographer's albums,
  // so the check must run with the service client.
  const supabase = createAdminClient();
  let slug = baseSlug || `album-${Date.now()}`;
  let counter = 1;

  while (true) {
    let query = supabase.from("albums").select("id").eq("slug", slug);
    if (albumId) query = query.neq("id", albumId);

    const { data } = await query.maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug}-${counter++}`;
  }
}

async function upsertClientFromForm(ownerId: string, formData: FormData, existingClientId?: string | null) {
  const supabase = await createClient();

  const selectedClientId = String(formData.get("clientId") ?? "").trim();
  const name = String(formData.get("clientName") ?? "").trim();
  const email = String(formData.get("clientEmail") ?? "").trim() || null;
  const phone = String(formData.get("clientPhone") ?? "").trim() || null;
  const notes = String(formData.get("clientNotes") ?? "").trim() || null;

  // Picked a different existing client from the dropdown.
  if (selectedClientId && selectedClientId !== existingClientId) return selectedClientId;

  // Editing the client already linked to this album: save the edited fields
  // (previously the edits were silently ignored).
  const linkedId = selectedClientId || existingClientId;
  if (linkedId) {
    if (name) {
      await supabase
        .from("clients")
        .update({ name, email, phone, notes })
        .eq("id", linkedId)
        .eq("owner_id", ownerId);
    }
    return linkedId;
  }

  if (!name) return null;

  const { data } = await supabase
    .from("clients")
    .insert({
      owner_id: ownerId,
      name,
      email,
      phone,
      notes,
    })
    .select("id")
    .single();

  return data?.id ?? null;
}

function buildAlbumPayload(formData: FormData, shareToken?: string) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const visibility = String(formData.get("visibility") ?? "private").trim() === "public" ? "public" : "private";
  const galleryPassword = String(formData.get("galleryPassword") ?? "").trim();
  const eventDate = String(formData.get("eventDate") ?? "").trim() || null;
  const status = parseStatus(String(formData.get("status") ?? "Draft"));
  const limitRaw = Number.parseInt(String(formData.get("selectionLimit") ?? "").trim(), 10);
  const selectionLimit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : null;
  const removePassword = formData.get("removePassword") === "on";
  // A date picked in the form means "until the end of that day" in Vietnam.
  const expiresOn = String(formData.get("expiresOn") ?? "").trim();
  const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(expiresOn) ? `${expiresOn}T23:59:59+07:00` : null;

  return {
    title,
    slugSeed: slugify(title),
    status,
    visibility,
    description,
    event_date: eventDate,
    expires_at: expiresAt,
    password: galleryPassword,
    removePassword,
    selection_limit: selectionLimit,
    share_token: shareToken,
  };
}

export async function createAlbumAction(formData: FormData) {
  const profile = await requireAdminProfile();
  const supabase = await createClient();
  const payload = buildAlbumPayload(formData);
  if (!payload.title) {
    redirect("/dashboard/albums/new?error=title");
  }
  const slug = await ensureUniqueSlug(payload.slugSeed);
  const clientId = await upsertClientFromForm(profile.id, formData);

  const insertData = {
    owner_id: profile.id,
    client_id: clientId,
    title: payload.title,
    slug,
    description: payload.description,
    status: payload.status,
    visibility: payload.visibility,
    event_date: payload.event_date,
    selection_limit: payload.selection_limit,
    ...(payload.expires_at ? { expires_at: payload.expires_at } : {}),
    ...(formData.get("allowDownload") === "on" ? { allow_download: true } : {}),
    password_hash: payload.password ? await bcrypt.hash(payload.password, 10) : null,
  };

  const { data, error } = await supabase.from("albums").insert(insertData).select("id").single();

  if (error || !data) {
    console.error("createAlbum failed", error?.message);
    redirect("/dashboard/albums/new?error=save");
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/albums/${data.id}/upload`);
}

export async function updateAlbumAction(formData: FormData) {
  const profile = await requireAdminProfile();
  const albumId = String(formData.get("albumId") ?? "").trim();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("albums")
    .select("*")
    .eq("id", albumId)
    .eq("owner_id", profile.id)
    .single();

  if (!existing) {
    redirect("/dashboard");
  }

  const payload = buildAlbumPayload(formData, existing.share_token);
  // Keep the slug stable: regenerating it from the title broke every share
  // link already sent to the client whenever the title was edited.
  const slug = existing.slug;
  const clientId = await upsertClientFromForm(profile.id, formData, existing.client_id);

  const updateData = {
    title: payload.title,
    slug,
    description: payload.description,
    status: payload.status,
    visibility: payload.visibility,
    event_date: payload.event_date,
    client_id: clientId,
    selection_limit: payload.selection_limit,
    // Only touch expires_at when there is something to set or clear, so editing
    // keeps working on a database that has not run migration 0003 yet.
    ...(payload.expires_at || existing.expires_at ? { expires_at: payload.expires_at } : {}),
    // Same for allow_download (migration 0004).
    ...(formData.get("allowDownload") === "on" || existing.allow_download
      ? { allow_download: formData.get("allowDownload") === "on" }
      : {}),
    ...(payload.status === "Delivered" && !existing.delivered_at
      ? { delivered_at: new Date().toISOString() }
      : {}),
    ...(payload.removePassword
      ? { password_hash: null }
      : payload.password
        ? { password_hash: await bcrypt.hash(payload.password, 10) }
        : {}),
  };

  const { error } = await supabase
    .from("albums")
    .update(updateData)
    .eq("id", albumId)
    .eq("owner_id", profile.id);

  if (error) {
    console.error("updateAlbum failed", error.message);
    redirect(`/dashboard/albums/${albumId}/edit?error=save`);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/albums/${albumId}/edit`);
  revalidatePath(`/gallery/${slug}`);
  redirect("/dashboard");
}

export async function setAlbumStatusAction(formData: FormData) {
  const profile = await requireAdminProfile();
  const albumId = String(formData.get("albumId") ?? "").trim();
  const status = parseStatus(String(formData.get("status") ?? ""));
  const supabase = await createClient();

  await supabase
    .from("albums")
    .update({
      status,
      ...(status === "Delivered" ? { delivered_at: new Date().toISOString() } : {}),
    })
    .eq("id", albumId)
    .eq("owner_id", profile.id);

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/albums/${albumId}/selections`);
  redirect(`/dashboard/albums/${albumId}/selections`);
}

/** Status change from the album cards (no redirect). */
export async function updateAlbumStatus(albumId: string, status: string) {
  const profile = await requireAdminProfile();
  const next = parseStatus(status);
  const supabase = await createClient();
  const { error } = await supabase
    .from("albums")
    .update({
      status: next,
      ...(next === "Delivered" ? { delivered_at: new Date().toISOString() } : {}),
    })
    .eq("id", albumId)
    .eq("owner_id", profile.id);
  revalidatePath("/dashboard");
  return { ok: !error };
}

function revalidateAlbum(albumId: string) {
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/albums/${albumId}`, "layout");
  revalidatePath("/portfolio");
  revalidatePath("/");
}

/** New share token: links sent earlier stop working. Returns the new client path. */
export async function resetShareLink(albumId: string) {
  const profile = await requireAdminProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("albums")
    .update({ share_token: crypto.randomUUID() })
    .eq("id", albumId)
    .eq("owner_id", profile.id)
    .select("slug, share_token, visibility")
    .single();
  revalidateAlbum(albumId);
  if (error || !data) return { ok: false as const };
  const query = data.visibility === "private" ? `?share=${data.share_token}` : "";
  return { ok: true as const, sharePath: `/gallery/${data.slug}${query}` };
}

/** Archive hides the album everywhere (dashboard list, portfolio, client link) without deleting it. */
export async function setAlbumArchived(albumId: string, archived: boolean) {
  const profile = await requireAdminProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("albums")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", albumId)
    .eq("owner_id", profile.id);
  if (error) console.error("setAlbumArchived failed", error.message);
  revalidateAlbum(albumId);
  return { ok: !error };
}

/** Deletes the album, its selections and the photo files in storage. */
export async function deleteAlbum(albumId: string) {
  const profile = await requireAdminProfile();
  const supabase = await createClient();
  const { data: album } = await supabase
    .from("albums")
    .select("id")
    .eq("id", albumId)
    .eq("owner_id", profile.id)
    .maybeSingle();
  if (!album) return { ok: false as const };

  // Collect the storage paths first: rows disappear with the album (on delete cascade).
  const { data: photos } = await supabase
    .from("photos")
    .select("file_path, preview_path, storage_bucket")
    .eq("album_id", albumId)
    .limit(100000);

  const { error } = await supabase.from("albums").delete().eq("id", albumId).eq("owner_id", profile.id);
  if (error) {
    console.error("deleteAlbum failed", error.message);
    return { ok: false as const };
  }

  const byBucket = new Map<string, string[]>();
  for (const photo of photos ?? []) {
    const list = byBucket.get(photo.storage_bucket) ?? [];
    list.push(photo.file_path);
    if (photo.preview_path) list.push(photo.preview_path);
    byBucket.set(photo.storage_bucket, list);
  }
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 500) {
      await removeObjects(paths.slice(i, i + 500), bucket).catch((err) =>
        console.error("[storage] album cleanup failed", err)
      );
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/portfolio");
  revalidatePath("/");
  return { ok: true as const };
}

export async function setCoverPhoto(albumId: string, photoId: string | null) {
  const profile = await requireAdminProfile();
  const supabase = await createClient();
  if (photoId) {
    const { data: photo } = await supabase
      .from("photos")
      .select("id")
      .eq("id", photoId)
      .eq("album_id", albumId)
      .maybeSingle();
    if (!photo) return { ok: false };
  }
  const { error } = await supabase
    .from("albums")
    .update({ cover_photo_id: photoId })
    .eq("id", albumId)
    .eq("owner_id", profile.id);
  revalidateAlbum(albumId);
  return { ok: !error };
}

/** Saves the photo order (ids in display order) in one database call. */
export async function reorderPhotos(albumId: string, photoIds: string[]) {
  const profile = await requireAdminProfile();
  if (!Array.isArray(photoIds) || photoIds.length > 20000) return { ok: false };
  const supabase = await createClient();
  const { data: album } = await supabase
    .from("albums")
    .select("id, slug")
    .eq("id", albumId)
    .eq("owner_id", profile.id)
    .maybeSingle();
  if (!album) return { ok: false };
  const { error } = await supabase.rpc("reorder_album_photos", { target_album: albumId, photo_ids: photoIds });
  if (error) console.error("reorderPhotos failed", error.message);
  revalidatePath(`/gallery/${album.slug}`);
  return { ok: !error };
}
