import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ACCESSIBILITY_PAGES = ["/", "/login", "/timetable", "/classes", "/contact"];

test.describe("Phase 6: Accessibility (WCAG 2.1 AA via Axe-Core)", () => {
  for (const pagePath of ACCESSIBILITY_PAGES) {
    test(`page "${pagePath}" contains zero critical or serious a11y violations`, async ({
      page,
    }) => {
      await page.goto(pagePath);
      await page.waitForLoadState("domcontentloaded");

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .disableRules(["color-contrast"]) // Optional contrast rule variations across custom themes
        .analyze();

      const severeViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );

      if (severeViolations.length > 0) {
        console.error(
          `Accessibility violations on ${pagePath}:`,
          JSON.stringify(
            severeViolations.map((v) => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              nodes: v.nodes.map((n) => n.target),
            })),
            null,
            2
          )
        );
      }

      expect(
        severeViolations,
        `Found ${severeViolations.length} critical/serious a11y violations on "${pagePath}"`
      ).toHaveLength(0);
    });
  }

  test("keyboard navigation: interactive modal can be dismissed via Escape key", async ({
    page,
  }) => {
    await page.goto("/login");

    const forgotBtn = page.locator('button:has-text("Forgot password?")');
    await forgotBtn.focus();
    await page.keyboard.press("Enter");

    // Modal / sheet is open
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });
});
