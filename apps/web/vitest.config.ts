import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

import pkg from "./package.json";

// Unit tests of the app's pure modules only. tests/ holds the Playwright suite (playwright.config.ts),
// which Vitest must not collect. `@/` resolves to src/ as in tsconfig.json.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // What next.config.js injects into the bundle (the interface version).
    env: { NEXT_PUBLIC_XPAND_UI_VERSION: pkg.version },
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,mjs}"],
    environment: "node",
  },
});
