import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { BUILD_DEFINE } from "./build-define";

// Default port of the XPAND server (apps/server). XPAND_SERVER_PORT overrides it, as it does for the server.
const SERVER_PORT = process.env.XPAND_SERVER_PORT ?? "8870";

// The app is served at the root by the XPAND server (apps/server), which also serves /api.
export default defineConfig({
  base: "/",
  define: BUILD_DEFINE,
  plugins: [react(), tailwindcss()],
  // ajv is loaded lazily by the API client (it validates every response, in development and in production):
  // pre-bundle it, so that Vite does not discover it mid-session and reload the page.
  optimizeDeps: { include: ["ajv"] },
  // `pnpm dev` talks to a local XPAND server. Only /api is proxied: the app's own assets come from Vite.
  server: {
    proxy: {
      "/api": { target: `http://127.0.0.1:${SERVER_PORT}`, changeOrigin: false },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
