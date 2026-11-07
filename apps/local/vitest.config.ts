import { defineConfig } from "vitest/config";

// Unit tests of the app's pure modules. The browser flows are in e2e/ (Playwright, see playwright.config.ts).
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
