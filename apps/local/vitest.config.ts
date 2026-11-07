import { defineConfig } from "vitest/config";
import { BUILD_DEFINE } from "./build-define";

// Unit tests of the app's pure modules. The browser flows are in e2e/ (Playwright, see playwright.config.ts).
export default defineConfig({
  define: BUILD_DEFINE,
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
