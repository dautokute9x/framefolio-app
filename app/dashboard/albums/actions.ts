 "use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminProfile } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { JOB_STATUSES } from "@/lib/constants";
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

  return {
    title,
    slugSeed: slugify(title),
    status,
    visibility,
    description,
    event_date: eventDate,
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

export async function refreshShareLinkAction(formData: FormData) {
  const profile = await requireAdminProfile();
  const albumId = String(formData.get("albumId") ?? "").trim();
  const supabase = await createClient();

  await supabase
    .from("albums")
    .update({ share_token: crypto.randomUUID() })
    .eq("id", albumId)
    .eq("owner_id", profile.id);

  revalidatePath("/dashboard");
  redirect("/dashboard");
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
