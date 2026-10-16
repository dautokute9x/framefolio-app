import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

async function getCurrentAuthUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function getCurrentProfile() {
  const user = await getCurrentAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle<Profile>();

  return data ?? null;
}

export async function requireAdminProfile() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login?notice=signIn");
  }
  return profile;
}
