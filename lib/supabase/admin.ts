import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let adminClient: ReturnType<typeof createClient> | null = null;

export function createAdminClient() {
  if (!adminClient) {
    adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}
