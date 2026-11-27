import { test, expect } from "@playwright/test";

test.describe("E2E: Authentication & Security Gateways", () => {
  test("login page renders credentials form, password toggle and forgot password sheet", async ({ page }) => {
    await page.goto("/login");

    // Verify inputs
    const emailInput = page.locator("#login-email");
    const passwordInput = page.locator("#login-password");
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Verify password toggle button
    const toggleBtn = page.locator('button[aria-label="Show password"]');
    await expect(toggleBtn).toBeVisible();

    // Enter text and toggle password visibility
    await passwordInput.fill("SuperSecret123!");
    await expect(passwordInput).toHaveAttribute("type", "password");
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    const hideBtn = page.locator('button[aria-label="Hide password"]');
    await hideBtn.click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("empty credential submission displays descriptive error notification", async ({ page }) => {
    await page.goto("/login");

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Error toast should appear
    const toast = page.locator('text="Please enter both your email address and password."');
    await expect(toast).toBeVisible();
  });

  test("forgot password sheet opens and closes with Escape key", async ({ page }) => {
    await page.goto("/login");

    const forgotBtn = page.locator('button:has-text("Forgot password?")');
    await forgotBtn.click();

    const resetTitle = page.locator('h2:has-text("Reset Password")');
    await expect(resetTitle).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");
    await expect(resetTitle).not.toBeVisible();
  });

  test("unauthenticated access to protected /owner route redirects to /login", async ({ page }) => {
    await page.goto("/owner");
    // Should be redirected or prompted for login
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });
});
