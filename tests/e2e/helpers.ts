import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

/** Demo data created by `npm run seed:demo`. */
export const DEMO = {
  email: "demo@framefolio.local",
  password: "Demo123!",
  galleryPassword: "client123",
  privateSlug: "north-studio-brand-refresh",
  publicSlug: "alicia-marcus",
};

export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for e2e tests");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getAlbum(slug: string) {
  const { data, error } = await serviceClient()
    .from("albums")
    .select("id, slug, share_token, status, visibility, owner_id")
    .eq("slug", slug)
    .single();
  if (error || !data) throw new Error(`Album ${slug} not found — run npm run seed:demo first`);
  return data as { id: string; slug: string; share_token: string; status: string; visibility: string; owner_id: string };
}

export async function login(page: Page, email = DEMO.email, password = DEMO.password) {
  await page.goto("/login");
  await page.locator('form input[name="email"]').first().fill(email);
  await page.locator('form input[name="password"]').first().fill(password);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForLoadState("networkidle");
}

export async function countSelections(albumId: string, excludeKey = "demo-client-selection") {
  const { count } = await serviceClient()
    .from("selections")
    .select("id", { count: "exact", head: true })
    .eq("album_id", albumId)
    .neq("selection_key", excludeKey);
  return count ?? 0;
}
