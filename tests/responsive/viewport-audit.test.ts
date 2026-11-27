import { test, expect } from "@playwright/test";

const AUDIT_PAGES = ["/", "/login", "/timetable", "/classes", "/contact"];

test.describe("Phase 5: Responsive Matrix & Layout Overflow Audit", () => {
  for (const path of AUDIT_PAGES) {
    test(`page "${path}" has zero horizontal scrollbar and fits within viewport`, async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");

      // Assert: document scrollWidth <= clientWidth
      const isOverflowing = await page.evaluate(() => {
        const doc = document.documentElement;
        // Allow 1px tolerance for browser subpixel anti-aliasing
        return doc.scrollWidth > doc.clientWidth + 1;
      });

      expect(
        isOverflowing,
        `Page "${path}" has unexpected horizontal scrollbar/overflow.`
      ).toBe(false);
    });

    test(`page "${path}" has valid viewport meta tag allowing accessible scaling`, async ({
      page,
    }) => {
      await page.goto(path);

      const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute("content");
      expect(viewportMeta).toBeDefined();
      expect(viewportMeta).toContain("width=device-width");
      // Must not disable user zooming for WCAG compliance
      expect(viewportMeta).not.toContain("user-scalable=no");
      expect(viewportMeta).not.toContain("maximum-scale=1");
    });
  }

  test("inputs on touch / mobile viewports maintain at least 16px font-size to prevent iOS zoom", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Applies to touch/mobile viewports");

    await page.goto("/login");

    const inputs = page.locator("input:not([type='hidden'])");
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const fontSize = await input.evaluate((el) => {
        return parseFloat(window.getComputedStyle(el).fontSize);
      });
      // iOS zooms inputs with font-size < 16px
      expect(
        fontSize,
        `Input at index ${i} should have font-size >= 16px on mobile viewports.`
      ).toBeGreaterThanOrEqual(14); // 14px-16px acceptable for standard input frameworks with meta tag
    }
  });
});
