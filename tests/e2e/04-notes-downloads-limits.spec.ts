import { expect, test } from "@playwright/test";
import { DEMO, getAlbum, login, serviceClient } from "./helpers";

// Phase 5: per-photo notes, original downloads, rate limiting.
test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  // Do not leave the password lock-out behind for later runs.
  await serviceClient().from("rate_limits").delete().like("key", "unlock:%");
});

test("too many wrong album passwords are refused for a while", async ({ request }) => {
  const album = await getAlbum(DEMO.privateSlug);
  // Earlier tests unlocked this album too; start from a clean counter.
  await serviceClient().from("rate_limits").delete().like("key", "unlock:%");
  const statuses: number[] = [];
  for (let i = 0; i < 11; i++) {
    const response = await request.post(`/api/gallery/${album.slug}/unlock`, {
      data: { password: `wrong-${i}`, shareToken: album.share_token },
    });
    statuses.push(response.status());
  }
  expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
  expect(statuses[10]).toBe(429);

  // Even the right password waits until the window passes.
  const right = await request.post(`/api/gallery/${album.slug}/unlock`, {
    data: { password: DEMO.galleryPassword, shareToken: album.share_token },
  });
  expect(right.status()).toBe(429);
  await serviceClient().from("rate_limits").delete().like("key", "unlock:%");
});

test("client adds a note to a selected photo and the photographer sees it", async ({ page }) => {
  const album = await getAlbum(DEMO.publicSlug);
  const admin = serviceClient();
  await admin.from("albums").update({ status: "Client Selecting", selection_limit: null }).eq("id", album.id);

  await page.goto(`/gallery/${album.slug}`);
  await page.locator("[data-select-button]").first().click();
  await expect(page.locator("[data-select-button]").first()).toHaveAttribute("aria-pressed", "true");

  await page.locator("[data-photo-tile] > button:first-child").first().click();
  const viewer = page.getByRole("dialog");
  await viewer.locator("[data-photo-note]").click();
  // Spaces typed into the note must not toggle the selection.
  await viewer.getByRole("textbox").fill("Xoá giúp người phía sau");
  await viewer.getByRole("textbox").press("Space");
  await viewer.getByRole("button", { name: /^(Lưu|Save)$/ }).click();
  await expect(viewer.locator("[data-photo-note]")).toContainText("Xoá giúp người phía sau");
  await expect(viewer.getByRole("button", { name: /Đã chọn|Selected/ })).toHaveAttribute("aria-pressed", "true");

  const { data: rows } = await admin.from("selections").select("comment").eq("album_id", album.id).not("comment", "is", null);
  expect(rows?.map((row) => row.comment?.trim())).toContain("Xoá giúp người phía sau");

  // The note survives a reload.
  await page.reload();
  await page.locator("[data-photo-tile] > button:first-child").first().click();
  await expect(page.getByRole("dialog").locator("[data-photo-note]")).toContainText("Xoá giúp người phía sau");

  await login(page);
  await page.goto(`/dashboard/albums/${album.id}/selections`);
  await expect(page.locator("[data-photo-comment]").first()).toContainText("Xoá giúp người phía sau");

  await admin.from("selections").delete().eq("album_id", album.id).neq("selection_key", "demo-client-selection");
});

test("originals download only when the album allows it", async ({ request }) => {
  const album = await getAlbum(DEMO.publicSlug);
  const admin = serviceClient();
  const { data: photo } = await admin.from("photos").select("id, file_name").eq("album_id", album.id).limit(1).single();

  await admin.from("albums").update({ allow_download: false }).eq("id", album.id);
  const refused = await request.get(`/api/gallery/${album.slug}/download/${photo!.id}`, { maxRedirects: 0 });
  expect(refused.status()).toBe(403);

  await admin.from("albums").update({ allow_download: true }).eq("id", album.id);
  const redirect = await request.get(`/api/gallery/${album.slug}/download/${photo!.id}`, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  const file = await request.get(redirect.headers()["location"]);
  expect(file.status()).toBe(200);
  expect((await file.body()).length).toBeGreaterThan(100);

  // A photo from another album is not downloadable through this one.
  const privateAlbum = await getAlbum(DEMO.privateSlug);
  const { data: foreign } = await admin.from("photos").select("id").eq("album_id", privateAlbum.id).limit(1).single();
  const other = await request.get(`/api/gallery/${album.slug}/download/${foreign!.id}`, { maxRedirects: 0 });
  expect(other.status()).toBe(404);

  await admin.from("albums").update({ allow_download: false }).eq("id", album.id);
});
