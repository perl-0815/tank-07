import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  timeout: 45000,
  expect: { timeout: 7000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3008",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    reducedMotion: "reduce",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command: "pnpm exec next start --hostname 127.0.0.1 --port 3008",
    url: "http://127.0.0.1:3008",
    reuseExistingServer: !process.env.CI,
  },
});
