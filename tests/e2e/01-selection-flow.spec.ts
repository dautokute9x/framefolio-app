import path from "path";
import { devices, expect, test } from "@playwright/test";
import { DEMO, countSelections, getAlbum, login, serviceClient } from "./helpers";

// Photographer uploads → client picks on a phone → submits → photographer reviews.
test.describe.configure({ mode: "serial" });

const fixtures = ["DSC_0001.jpg", "DSC_0002.jpg", "DSC_0003.jpg"].map((name) =>
  path.join(__dirname, "..", "fixtures", name)
);

test.beforeAll(async () => {
  // Re-open the album in case an earlier run locked it.
  const album = await getAlbum(DEMO.privateSlug);
  const admin = serviceClient();
  await admin.from("albums").update({ status: "Client Selecting", selection_limit: null }).eq("id", album.id);
  await admin.from("selections").delete().eq("album_id", album.id).neq("selection_key", "demo-client-selection");
  await admin.from("selection_sessions").delete().eq("album_id", album.id);
});

test("photographer uploads photos in file-name order with previews", async ({ page }) => {
  const album = await getAlbum(DEMO.privateSlug);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto(`/dashboard/albums/${album.id}/upload`);
  const before = (await serviceClient().from("photos").select("id").eq("album_id", album.id)).data?.length ?? 0;

  // Pick the files in reverse order: they must still be stored as DSC_0001, 0002, 0003.
  await page.locator('input[type="file"]').setInputFiles([...fixtures].reverse());
  await expect(page.locator("[data-upload-queue]")).toContainText("3/3", { timeout: 45_000 });

  const { data: photos } = await serviceClient()
    .from("photos")
    .select("file_name, sort_order, preview_path, width, height")
    .eq("album_id", album.id)
    .order("sort_order");
  const added = (photos ?? []).slice(before);
  expect(added.map((p) => p.file_name)).toEqual(["DSC_0001.jpg", "DSC_0002.jpg", "DSC_0003.jpg"]);
  expect(new Set(added.map((p) => p.sort_order)).size).toBe(3);
  expect(added.every((p) => p.preview_path)).toBe(true);
  expect(added.find((p) => p.file_name === "DSC_0002.jpg")).toMatchObject({ width: 3000, height: 2000 });
  expect(errors).toEqual([]);
});

test.describe("client on a phone", () => {
  // Phone-sized viewport with touch, on the configured Chromium.
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 7"];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test("opens the share link, unlocks, picks, submits", async ({ page }) => {
    const album = await getAlbum(DEMO.privateSlug);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(`/gallery/${album.slug}?share=${album.share_token}`);
    expect(response?.status()).toBe(200);

    await page.locator('input[type="password"]').fill(DEMO.galleryPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page.locator("[data-photo-tile]").first()).toBeVisible();
    const tiles = await page.locator("[data-photo-tile]").count();
    expect(tiles).toBeGreaterThanOrEqual(7);

    const buttons = page.locator("[data-select-button]");
    // Double tap on the same photo ends in a consistent state (selected or not), never an error.
    await buttons.nth(0).click();
    await buttons.nth(0).click();
    await buttons.nth(1).click();
    await expect.poll(() => countSelections(album.id)).toBeGreaterThanOrEqual(1);
    const afterTaps = await countSelections(album.id);
    await expect(page.locator("[data-selected-count]")).toContainText(String(afterTaps));

    // Full-screen viewer: select a third photo from there.
    await page.locator("[data-photo-tile] > button:first-child").nth(2).click();
    await page.getByRole("dialog").getByRole("button", { name: /Chọn ảnh này|Select this photo/ }).click();
    await expect.poll(() => countSelections(album.id)).toBe(afterTaps + 1);
    await page.getByRole("dialog").getByRole("button", { name: /Đóng|Close/ }).click();

    // Submit with a name and a note.
    await page.getByRole("button", { name: /Gửi lựa chọn|Send selection/ }).click();
    await page.locator("input[name=selectorName]").fill("Chị Lan");
    await page.locator("textarea[name=note]").fill("Ảnh #3 xoá giúp người phía sau");
    await page.getByRole("button", { name: /Xác nhận gửi|Confirm/ }).click();

    await expect
      .poll(async () => (await getAlbum(album.slug)).status)
      .toBe("Editing");
    const { data: session } = await serviceClient()
      .from("selection_sessions")
      .select("selector_name, note, submitted_at")
      .eq("album_id", album.id)
      .not("submitted_at", "is", null)
      .single();
    expect(session?.selector_name).toBe("Chị Lan");

    // Locked: the API refuses further changes.
    const { data: photo } = await serviceClient().from("photos").select("id").eq("album_id", album.id).limit(1).single();
    const locked = await page.request.post(`/api/gallery/${album.slug}/select`, {
      data: { photoId: photo!.id, selected: true, shareToken: album.share_token },
    });
    expect(locked.status()).toBe(423);

    // Review page for the client.
    await page.goto(`/gallery/${album.slug}/selected?share=${album.share_token}`);
    await expect(page.locator("body")).not.toContainText("could not be found");
    expect(errors).toEqual([]);
  });
});

test("photographer sees the submitted selection", async ({ page }) => {
  const album = await getAlbum(DEMO.privateSlug);
  await login(page);
  await page.goto(`/dashboard/albums/${album.id}/selections`);
  await expect(page.locator("body")).toContainText("Chị Lan");
  await expect(page.locator("body")).toContainText("Ảnh #3 xoá");
});

test("public portfolio lists the public album and opens it", async ({ page }) => {
  await page.goto("/portfolio");
  await expect(page.locator(`a[href="/gallery/${DEMO.publicSlug}"]`).first()).toBeVisible();
  const response = await page.goto(`/gallery/${DEMO.publicSlug}`);
  expect(response?.status()).toBe(200);
  await expect(page.locator("[data-photo-tile]").first()).toBeVisible();
});

test("dashboard 'Open album' links open the gallery on this site", async ({ page, context }) => {
  await login(page);
  const menus = page.getByRole("button", { name: /Thao tác khác|More actions/ });
  await expect(menus.first()).toBeVisible();
  const count = await menus.count();
  expect(count).toBeGreaterThan(0);
  const hrefs: string[] = [];
  for (let i = 0; i < count; i++) {
    const link = page.getByRole("menuitem", { name: /Mở album|Open album/ });
    // Retry the click in case it landed before the page finished hydrating.
    await expect(async () => {
      if (!(await link.isVisible())) await menus.nth(i).click();
      await expect(link).toBeVisible({ timeout: 1_000 });
    }).toPass();
    hrefs.push((await link.getAttribute("href"))!);
    await page.keyboard.press("Escape");
  }
  for (const href of hrefs) {
    expect(href).toMatch(/^\/gallery\//);
    const popup = await context.newPage();
    const response = await popup.goto(href);
    expect(response?.status()).toBe(200);
    await popup.close();
  }
});

test("language switch changes the dashboard to English and back", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: /^en$/i }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Albums");
  await page.getByRole("button", { name: /^vi$/i }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Album");
});
