import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The app is served by the XPAND server under /app/ (the static build is committed to web/app/ in xpand).
export default defineConfig({
  base: "/app/",
  plugins: [react(), tailwindcss()],
  // ajv is loaded lazily in development (the API client validates there): pre-bundle it, so that Vite does not
  // discover it mid-session and reload the page.
  optimizeDeps: { include: ["ajv"] },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
