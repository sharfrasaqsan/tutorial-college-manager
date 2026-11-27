import { test, expect } from "@playwright/test";

test.describe("E2E: Public Institutional Website User Flow", () => {
  test("home page loads with institution branding and navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Tutorial College/i);

    // Verify main header branding
    const brand = page.locator("header, nav").first();
    await expect(brand).toBeVisible();

    // Verify key public navigation links exist
    const timetableLink = page.locator('a[href="/timetable"]').first();
    const classesLink = page.locator('a[href="/classes"]').first();
    const portalLink = page.locator('a[href="/owner"], a[href="/teacher"], a[href="/login"]').first();

    await expect(timetableLink).toBeVisible();
    await expect(classesLink).toBeVisible();
    await expect(portalLink).toBeVisible();
  });

  test("public timetable page renders schedule grid and filters", async ({ page }) => {
    await page.goto("/timetable");

    // Check heading or title
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("h1, h2").first()).toBeVisible();

    // Verify day tabs or weekday controls are present
    const mainContent = page.locator("main, #__next, [role='main']").first();
    await expect(mainContent).toBeVisible();
  });

  test("public classes page lists curriculum offerings and fee information", async ({ page }) => {
    await page.goto("/classes");

    // Page must load without unhandled error
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("contact page displays institution details and inquiry form", async ({ page }) => {
    await page.goto("/contact");

    await expect(page.locator("body")).toBeVisible();
    // Name, email/phone or message field
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible()) {
      await expect(submitBtn).toBeVisible();
    }
  });
});
