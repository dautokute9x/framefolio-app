import fs from "fs";
import path from "path";
import { expect, test, type Page } from "@playwright/test";
import { DEMO, getAlbum, login, serviceClient } from "./helpers";

// Phase 4: archive, expiry, share-link reset, delete, photo order, cover, clients.
test.describe.configure({ mode: "serial" });

const BUCKET = "albums";
const fixture = fs.readFileSync(path.join(__dirname, "..", "fixtures", "DSC_0001.jpg"));

/** A throwaway private album with `count` photos, created directly in the database and storage. */
async function createAlbum(title: string, count = 3) {
  const admin = serviceClient();
  const owner = (await getAlbum(DEMO.privateSlug)).owner_id;
  const slug = `e2e-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const { data: album, error } = await admin
    .from("albums")
    .insert({ owner_id: owner, title, slug, status: "Client Selecting", visibility: "private" })
    .select("id, slug, share_token")
    .single();
  if (error || !album) throw new Error(`create album: ${error?.message}`);

  const photos = [];
  for (let i = 1; i <= count; i++) {
    const filePath = `${owner}/${album.id}/IMG_${i}.jpg`;
    const upload = await admin.storage.from(BUCKET).upload(filePath, fixture, { contentType: "image/jpeg", upsert: true });
    if (upload.error) throw new Error(`upload: ${upload.error.message}`);
    photos.push({
      album_id: album.id,
      owner_id: owner,
      file_name: `IMG_${i}.jpg`,
      file_path: filePath,
      storage_bucket: BUCKET,
      width: 1200,
      height: 800,
      sort_order: i,
    });
  }
  const { error: photoError } = await admin.from("photos").insert(photos);
  if (photoError) throw new Error(`photos: ${photoError.message}`);
  return { ...album, paths: photos.map((photo) => photo.file_path) };
}

async function objectExists(filePath: string) {
  const { data, error } = await serviceClient().storage.from(BUCKET).createSignedUrl(filePath, 60);
  if (error || !data) return false;
  return (await fetch(data.signedUrl)).ok;
}

async function openCardMenu(page: Page, title: string) {
  const card = page.locator("article", { has: page.getByRole("heading", { name: title }) });
  const trigger = card.getByRole("button", { name: /Thao tác khác|More actions/ });
  const menu = page.getByRole("menu");
  await expect(async () => {
    if (!(await menu.isVisible())) await trigger.click();
    await expect(menu).toBeVisible({ timeout: 1_000 });
  }).toPass();
  return menu;
}

test("archive hides an album from the client link and restore brings it back", async ({ page, request }) => {
  const album = await createAlbum(`Lưu trữ ${Date.now()}`, 1);
  const link = `/gallery/${album.slug}?share=${album.share_token}`;
  expect((await request.get(link)).status()).toBe(200);

  await login(page);
  const title = (await serviceClient().from("albums").select("title").eq("id", album.id).single()).data!.title;
  const menu = await openCardMenu(page, title);
  await menu.getByRole("menuitem", { name: /^(Lưu trữ|Archive)$/ }).click();
  await expect.poll(async () => (await serviceClient().from("albums").select("archived_at").eq("id", album.id).single()).data?.archived_at).not.toBeNull();
  expect((await request.get(link)).status()).toBe(404);
  const api = await request.post(`/api/gallery/${album.slug}/urls`, { data: { ids: [crypto.randomUUID()], shareToken: album.share_token } });
  expect(api.status()).toBe(404);

  // Archived albums only show under the "Archived" filter, where they can be restored.
  await page.reload();
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
  await page.getByRole("tab", { name: /Lưu trữ|Archived/ }).click();
  await page.locator("article", { has: page.getByRole("heading", { name: title }) }).getByRole("button", { name: /Khôi phục|Restore/ }).click();
  await expect.poll(async () => (await serviceClient().from("albums").select("archived_at").eq("id", album.id).single()).data?.archived_at).toBeNull();
  expect((await request.get(link)).status()).toBe(200);

  await serviceClient().from("albums").delete().eq("id", album.id);
});

test("an expired album shows a notice and refuses API calls", async ({ page, request }) => {
  const album = await createAlbum(`Hết hạn ${Date.now()}`, 1);
  await login(page);
  await page.goto(`/dashboard/albums/${album.id}/edit`);
  await page.locator("#expiresOn").fill("2020-01-31");
  await page.locator('button[type="submit"]').last().click();
  await page.waitForURL(/\/dashboard$/);
  const { data } = await serviceClient().from("albums").select("expires_at").eq("id", album.id).single();
  expect(new Date(data!.expires_at).toISOString()).toBe("2020-01-31T16:59:59.000Z");

  const response = await page.goto(`/gallery/${album.slug}?share=${album.share_token}`);
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).toContainText(/hết hạn|expired/i);
  await expect(page.locator("[data-photo-tile]")).toHaveCount(0);
  const photo = (await serviceClient().from("photos").select("id").eq("album_id", album.id).limit(1).single()).data!;
  const select = await request.post(`/api/gallery/${album.slug}/select`, {
    data: { photoId: photo.id, selected: true, shareToken: album.share_token },
  });
  expect(select.status()).toBe(410);

  await serviceClient().from("albums").delete().eq("id", album.id);
});

test("changing the share link invalidates the old one", async ({ page, request }) => {
  const album = await createAlbum(`Đổi link ${Date.now()}`, 1);
  await login(page);
  await page.goto(`/dashboard/albums/${album.id}/edit`);
  await page.getByRole("button", { name: /^(Đổi link chia sẻ|Change share link)$/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Đổi link|Change link/ }).click();
  await expect
    .poll(async () => (await serviceClient().from("albums").select("share_token").eq("id", album.id).single()).data?.share_token)
    .not.toBe(album.share_token);
  expect((await request.get(`/gallery/${album.slug}?share=${album.share_token}`)).status()).toBe(404);
  const fresh = (await serviceClient().from("albums").select("share_token").eq("id", album.id).single()).data!.share_token;
  expect((await request.get(`/gallery/${album.slug}?share=${fresh}`)).status()).toBe(200);

  await serviceClient().from("albums").delete().eq("id", album.id);
});

test("deleting an album removes its photos from storage", async ({ page }) => {
  const album = await createAlbum(`Xoá ${Date.now()}`, 2);
  expect(await objectExists(album.paths[0])).toBe(true);

  await login(page);
  await page.goto(`/dashboard/albums/${album.id}/edit`);
  await page.getByRole("button", { name: /^(Xoá album|Delete album)$/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Xoá vĩnh viễn|Delete permanently/ }).click();
  await page.waitForURL(/\/dashboard$/);

  const { data: rows } = await serviceClient().from("albums").select("id").eq("id", album.id);
  expect(rows).toEqual([]);
  const { count } = await serviceClient().from("photos").select("id", { count: "exact", head: true }).eq("album_id", album.id);
  expect(count).toBe(0);
  for (const filePath of album.paths) expect(await objectExists(filePath)).toBe(false);
});

test("photographer reorders photos and picks the cover", async ({ page }) => {
  const album = await createAlbum(`Sắp xếp ${Date.now()}`, 3);
  const admin = serviceClient();
  // Scramble the order so "by file name" has something to fix.
  const { data: photos } = await admin.from("photos").select("id, file_name").eq("album_id", album.id);
  const byName = new Map(photos!.map((photo) => [photo.file_name, photo.id]));
  await admin.rpc("reorder_album_photos", {
    target_album: album.id,
    photo_ids: [byName.get("IMG_3.jpg"), byName.get("IMG_1.jpg"), byName.get("IMG_2.jpg")],
  });

  await login(page);
  await page.goto(`/dashboard/albums/${album.id}/upload`);
  await page.getByRole("button", { name: /Sắp xếp ảnh|Arrange photos/ }).click();
  const arranger = page.locator("[data-photo-arranger]");
  await expect(arranger.locator("[data-arrange-item]").first()).toHaveAttribute("data-arrange-item", "IMG_3.jpg");
  await arranger.getByRole("button", { name: /Theo tên file|By file name/ }).click();
  await arranger.getByRole("button", { name: /Lưu thứ tự|Save order/ }).click();
  await expect(arranger).toHaveCount(0);

  const { data: ordered } = await admin.from("photos").select("file_name").eq("album_id", album.id).order("sort_order");
  expect(ordered!.map((photo) => photo.file_name)).toEqual(["IMG_1.jpg", "IMG_2.jpg", "IMG_3.jpg"]);

  // Star a photo as the cover.
  await page.getByRole("button", { name: /(Đặt IMG_2\.jpg làm ảnh bìa|Use IMG_2\.jpg as the cover)/ }).click();
  await expect
    .poll(async () => (await admin.from("albums").select("cover_photo_id").eq("id", album.id).single()).data?.cover_photo_id)
    .toBe(byName.get("IMG_2.jpg"));

  await admin.from("albums").delete().eq("id", album.id);
});

test("clients page adds, edits and deletes a client", async ({ page }) => {
  const name = `Khách thử ${Date.now()}`;
  await login(page);
  await page.goto("/dashboard/clients");
  await page.getByRole("button", { name: /Thêm khách|Add client/ }).click();
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="phone"]').fill("0901234567");
  await page.getByRole("button", { name: /^(Lưu|Save)$/ }).click();

  const card = page.locator(`[data-client-card="${name}"]`);
  await expect(card).toBeVisible();
  await expect(card).toContainText("0901234567");

  await card.getByRole("button", { name: /^(Sửa|Edit)$/ }).click();
  await page.locator('input[name="phone"]').fill("0907654321");
  await page.getByRole("button", { name: /^(Lưu|Save)$/ }).click();
  await expect(page.locator(`[data-client-card="${name}"]`)).toContainText("0907654321");

  await page.locator(`[data-client-card="${name}"]`).getByRole("button", { name: /^(Xoá|Delete)$/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Xoá khách|Delete client/ }).click();
  await expect(page.locator(`[data-client-card="${name}"]`)).toHaveCount(0);
  const { count } = await serviceClient().from("clients").select("id", { count: "exact", head: true }).eq("name", name);
  expect(count).toBe(0);
});
