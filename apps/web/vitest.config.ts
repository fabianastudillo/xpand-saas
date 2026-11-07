import { defineConfig } from "vitest/config";

// Unit tests of the app's pure modules only. tests/ holds the Playwright suite (playwright.config.ts),
// which Vitest must not collect.
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,mjs}"],
    environment: "node",
  },
});
