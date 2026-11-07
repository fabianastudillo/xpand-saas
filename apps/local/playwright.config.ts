import { defineConfig } from "@playwright/test";

const PORT = 4173;

// The e2e runs against the production build served by `vite preview`, so the fonts and chunks are the ones
// that ship. The API is mocked per test (e2e/mock-api.ts): no Julia server is needed.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  reporter: process.env.CI !== undefined ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    viewport: { width: 1440, height: 900 },
    locale: "es-ES",
    colorScheme: "light",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `vite build && vite preview --port ${String(PORT)} --strictPort`,
    url: `http://127.0.0.1:${String(PORT)}/app/`,
    reuseExistingServer: process.env.CI === undefined,
    timeout: 180_000,
  },
});
