import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

let adminClient: SupabaseClient<any, "public", any> | null = null;

export function createAdminClient(): SupabaseClient<any, "public", any> {
  if (!adminClient) {
    adminClient = createClient<any>(env.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}
