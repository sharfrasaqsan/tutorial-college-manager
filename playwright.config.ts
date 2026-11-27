import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false, // Run deterministically
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Mobile Viewports
    {
      name: "mobile-320x568",
      use: {
        viewport: { width: 320, height: 568 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: /.*(responsive|e2e|a11y).*\.test\.ts/,
    },
    {
      name: "mobile-360x640",
      use: {
        viewport: { width: 360, height: 640 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: /.*(responsive|e2e|a11y).*\.test\.ts/,
    },
    {
      name: "mobile-375x667",
      use: {
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: /.*(responsive|e2e|a11y).*\.test\.ts/,
    },
    {
      name: "mobile-390x844",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: /.*(responsive|e2e|a11y).*\.test\.ts/,
    },
    {
      name: "mobile-414x896",
      use: {
        viewport: { width: 414, height: 896 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: /.*(responsive|e2e|a11y).*\.test\.ts/,
    },

    // Tablet Viewports
    {
      name: "tablet-768x1024",
      use: {
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
      },
      testMatch: /.*(responsive|e2e|a11y).*\.test\.ts/,
    },
    {
      name: "tablet-820x1180",
      use: {
        viewport: { width: 820, height: 1180 },
        hasTouch: true,
      },
      testMatch: /.*(responsive|e2e|a11y).*\.test\.ts/,
    },
    {
      name: "tablet-1024x768",
      use: {
        viewport: { width: 1024, height: 768 },
      },
      testMatch: /.*(responsive|e2e|a11y).*\.test\.ts/,
    },

    // Desktop Viewports
    {
      name: "desktop-1280x720",
      use: {
        viewport: { width: 1280, height: 720 },
      },
      testMatch: /.*(responsive|e2e|a11y).*\.test\.ts/,
    },
    {
      name: "desktop-1440x900",
      use: {
        viewport: { width: 1440, height: 900 },
      },
      testMatch: /.*(responsive|e2e|a11y).*\.test\.ts/,
    },
    {
      name: "desktop-1920x1080",
      use: {
        viewport: { width: 1920, height: 1080 },
      },
      testMatch: /.*(responsive|e2e|a11y).*\.test\.ts/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
