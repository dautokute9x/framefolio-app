"use server";

import { revalidatePath } from "next/cache";
import { requireAdminProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ClientInput = { id?: string; name: string; phone?: string; email?: string; notes?: string };

export async function saveClient(input: ClientInput) {
  const profile = await requireAdminProfile();
  const name = input.name?.trim();
  if (!name) return { ok: false as const, reason: "nameRequired" as const };
  const values = {
    name: name.slice(0, 200),
    phone: input.phone?.trim().slice(0, 50) || null,
    email: input.email?.trim().slice(0, 200) || null,
    notes: input.notes?.trim().slice(0, 2000) || null,
  };
  const supabase = await createClient();
  const { error } = input.id
    ? await supabase.from("clients").update(values).eq("id", input.id).eq("owner_id", profile.id)
    : await supabase.from("clients").insert({ ...values, owner_id: profile.id });
  if (error) console.error("saveClient failed", error.message);
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard");
  return { ok: !error };
}

/** Only clients without albums can be deleted, so no album silently loses its client. */
export async function deleteClient(clientId: string) {
  const profile = await requireAdminProfile();
  const supabase = await createClient();
  const { count } = await supabase
    .from("albums")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("owner_id", profile.id);
  if (count) return { ok: false as const, reason: "hasAlbums" as const };
  const { error } = await supabase.from("clients").delete().eq("id", clientId).eq("owner_id", profile.id);
  revalidatePath("/dashboard/clients");
  return { ok: !error };
}
