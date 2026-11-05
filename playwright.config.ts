import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the production build. Run `npm run build` first;
// `npm run test:e2e` then serves dist/ with `vite preview`.
const port = 4173;
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}/`,
    locale: "de-CH",
    timezoneId: "Europe/Zurich",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "phone-390",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/`,
    // Never reuse a server that is already running: it may serve an older
    // build. A busy port fails fast instead (--strictPort).
    reuseExistingServer: false,
  },
});
