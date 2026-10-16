import { expect, test } from "@playwright/test";
import { DEMO, anonClient, getAlbum, login, serviceClient } from "./helpers";

// Regression checks for the security findings fixed in PR #1.
test.describe.configure({ mode: "serial" });

const stranger = { email: `stranger-${Date.now()}@example.com`, password: "Stranger-123!" };

test("a self-registered account does not become an admin", async ({ page }) => {
  const { error } = await anonClient().auth.signUp(stranger);
  expect(error).toBeNull();

  const { data: profile } = await serviceClient().from("users").select("id").eq("email", stranger.email).maybeSingle();
  expect(profile).toBeNull();

  await login(page, stranger.email, stranger.password);
  await expect(page).not.toHaveURL(/\/dashboard/);
});

test("photo DELETE ignores storage paths sent by the browser", async ({ page }) => {
  const album = await getAlbum(DEMO.privateSlug);
  const admin = serviceClient();
  const { data: victim } = await admin
    .from("photos")
    .select("file_path, storage_bucket")
    .eq("album_id", album.id)
    .order("sort_order")
    .limit(1)
    .single();

  // Signed in as the photographer, ask to delete a non-existent photo id while
  // passing a real file path: the file must survive.
  await login(page);
  const response = await page.request.delete(`/api/albums/${album.id}/photos`, {
    data: { photoId: "00000000-0000-4000-8000-000000000000", filePath: victim!.file_path },
  });
  expect(response.status()).toBe(404);

  const bucket = victim!.storage_bucket === "r2" ? null : "albums";
  if (bucket) {
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(victim!.file_path, 60);
    expect(error).toBeNull();
    expect(data?.signedUrl).toBeTruthy();
  }
});

test("a tampered gallery password cookie does not crash the page", async ({ browser, baseURL }) => {
  const album = await getAlbum(DEMO.privateSlug);
  const context = await browser.newContext();
  await context.addCookies([{ name: `album-access-${album.id}`, value: `${album.id}.abc`, url: baseURL! }]);
  const page = await context.newPage();
  const response = await page.goto(`/gallery/${album.slug}?share=${album.share_token}`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await context.close();
});

test("selecting a photo from another album is rejected", async ({ request }) => {
  const privateAlbum = await getAlbum(DEMO.privateSlug);
  const publicAlbum = await getAlbum(DEMO.publicSlug);
  const admin = serviceClient();
  await admin.from("albums").update({ status: "Client Selecting" }).eq("id", publicAlbum.id);
  const { data: foreign } = await admin.from("photos").select("id").eq("album_id", privateAlbum.id).limit(1).single();

  const response = await request.post(`/api/gallery/${publicAlbum.slug}/select`, {
    data: { photoId: foreign!.id, selected: true },
  });
  expect(response.status()).toBe(404);
  const { count } = await admin
    .from("selections")
    .select("id", { count: "exact", head: true })
    .eq("album_id", publicAlbum.id)
    .eq("photo_id", foreign!.id);
  expect(count).toBe(0);
});

test("photo URL endpoint follows the gallery access rules", async ({ request }) => {
  const privateAlbum = await getAlbum(DEMO.privateSlug);
  const publicAlbum = await getAlbum(DEMO.publicSlug);
  const admin = serviceClient();
  const { data: own } = await admin.from("photos").select("id").eq("album_id", publicAlbum.id).limit(1).single();
  const { data: foreign } = await admin.from("photos").select("id").eq("album_id", privateAlbum.id).limit(1).single();

  // Private album: no share token -> 404; token but no password -> 403.
  const noToken = await request.post(`/api/gallery/${privateAlbum.slug}/urls`, { data: { ids: [foreign!.id] } });
  expect(noToken.status()).toBe(404);
  const noPassword = await request.post(`/api/gallery/${privateAlbum.slug}/urls`, {
    data: { ids: [foreign!.id], shareToken: privateAlbum.share_token },
  });
  expect(noPassword.status()).toBe(403);

  // Public album signs its own photos and silently ignores other albums' ids.
  const response = await request.post(`/api/gallery/${publicAlbum.slug}/urls`, { data: { ids: [own!.id, foreign!.id] } });
  expect(response.status()).toBe(200);
  const { urls } = await response.json();
  expect(Object.keys(urls)).toEqual([own!.id]);
});

test("private galleries need the share token", async ({ request }) => {
  const album = await getAlbum(DEMO.privateSlug);
  expect((await request.get(`/gallery/${album.slug}`)).status()).toBe(404);
  expect((await request.get(`/gallery/${album.slug}?share=wrong`)).status()).toBe(404);
});

test("Vietnamese titles get readable slugs that survive renames", async ({ page }) => {
  const title = `Đám cưới Minh & Lan ${Date.now()}`;
  await login(page);
  await page.goto("/dashboard/albums/new");
  await page.locator("#title").fill(title);
  await page.locator('button[type="submit"]').last().click();
  await page.waitForURL(/\/upload/);

  const { data: created } = await serviceClient().from("albums").select("id, slug").eq("title", title).single();
  expect(created!.slug).toMatch(/^dam-cuoi-minh-lan-\d+$/);

  await page.goto(`/dashboard/albums/${created!.id}/edit`);
  await page.locator("#title").fill(`${title} (Đà Lạt)`);
  await page.locator('button[type="submit"]').last().click();
  await page.waitForURL(/\/dashboard$/);
  const { data: renamed } = await serviceClient().from("albums").select("slug").eq("id", created!.id).single();
  expect(renamed!.slug).toBe(created!.slug);

  await serviceClient().from("albums").delete().eq("id", created!.id);
});

test("login page exposes no demo credentials or open sign-up", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("body")).not.toContainText(DEMO.password);
  // Sign-up is off unless ALLOW_SIGNUP is set.
  await expect(page.locator('input[name="fullName"]')).toHaveCount(0);
});

test("health endpoint reports the database is reachable", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect((await response.json()).ok).toBe(true);
});
