 "use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env.server";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect("/login?error=invalid");
  }

  // Only the photographer has a profile row; anyone else is signed straight out.
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    redirect("/login?error=noAccess");
  }

  redirect("/dashboard");
}

export async function signUpAction(formData: FormData) {
  // Single-photographer app: sign-up is closed unless explicitly enabled
  // (ALLOW_SIGNUP=true) while creating the owner account.
  if (!serverEnv.allowSignup) {
    redirect("/login?error=signupDisabled");
  }
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    redirect(`/login?error=signupFailed&detail=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?notice=created");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
