import { expect, test, type Route } from "@playwright/test";
import { DEMO } from "./helpers";

// Loading feedback: busy submit buttons, the top progress bar and skeleton screens.
const slow = (ms: number) => async (route: Route) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await route.continue();
};

test("login button shows it is working while signing in", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(DEMO.email);
  await page.locator('input[name="password"]').fill(DEMO.password);
  await page.route(/\/login$/, slow(1500));
  const submit = page.locator('form button[type="submit"]').first();
  await submit.click();
  await expect(submit).toHaveAttribute("aria-busy", "true");
  await expect(submit).toBeDisabled();
  await page.waitForURL(/\/dashboard/);
});

test("the top bar runs while the next page loads", async ({ page }) => {
  await page.goto("/portfolio");
  await page.route(/_rsc=/, slow(1500));
  await page.locator(`a[href="/gallery/${DEMO.publicSlug}"]`).first().click();
  await expect(page.locator("[data-navigation-progress]")).toHaveAttribute("data-navigation-progress", "loading");
  await page.waitForURL(/\/gallery\//);
  await expect(page.locator("[data-navigation-progress]")).toHaveAttribute("data-navigation-progress", "idle");
});
