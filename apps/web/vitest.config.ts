import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests of the app's pure modules only. tests/ holds the Playwright suite (playwright.config.ts),
// which Vitest must not collect. `@/` resolves to src/ as in tsconfig.json.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,mjs}"],
    environment: "node",
  },
});
