import { defineConfig } from "vitest/config";

// Each workspace package is a Vitest project; a package may add its own vitest.config.ts (environment,
// setup files). Packages without one run with the defaults.
export default defineConfig({
  test: {
    projects: ["packages/*", "apps/*"],
  },
});
