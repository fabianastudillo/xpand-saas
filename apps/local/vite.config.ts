import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { BUILD_DEFINE } from "./build-define";

// The app is served by the XPAND server under /app/ (the static build is committed to web/app/ in xpand).
export default defineConfig({
  base: "/app/",
  define: BUILD_DEFINE,
  plugins: [react(), tailwindcss()],
  // ajv is loaded lazily in development (the API client validates there): pre-bundle it, so that Vite does not
  // discover it mid-session and reload the page.
  optimizeDeps: { include: ["ajv"] },
  // `pnpm dev` talks to a local XPAND server (INICIAR_GUI.bat, port 8850). Only /api is proxied: the app's own
  // assets come from Vite.
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:8850", changeOrigin: false },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
