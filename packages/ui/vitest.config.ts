import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    // Vitest replaces .css modules with "" by default, including `tokens.css?raw`, which the token tests read.
    css: true,
  },
});
