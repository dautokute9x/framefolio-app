import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Public name shown in headers and page titles: the photographer's profile
 * name (single-photographer app), falling back to the product name.
 */
export const getBrand = cache(async () => {
  try {
    const { data } = await createAdminClient()
      .from("users")
      .select("full_name")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return { name: (data?.full_name as string | null)?.trim() || "Framefolio" };
  } catch {
    return { name: "Framefolio" };
  }
});
