const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The interface version (the status bar compares it with the platform's, /api/config): this package's.
  // The «N» badge of `next dev` would sit on top of the visual baselines (tests/ide, @visual).
  devIndicators: false,
  // Only for the test that starts a second server without a database (tests/ide/sin-postgres.spec.ts), which must not
  // share the build folder of the first.
  distDir: process.env.XPAND_DIST_DIR || ".next",
  // Release: server.js autónomo (.next/standalone) con solo lo que la app usa. La raíz del rastreo es la del monorepo
  // para que entren los paquetes @xpand/* y sus dependencias; el servidor queda en apps/web/server.js.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  env: { NEXT_PUBLIC_XPAND_UI_VERSION: require("./package.json").version },
  // Los paquetes del monorepo exportan su TypeScript fuente: Next los compila con la app.
  transpilePackages: ["@xpand/api", "@xpand/casos", "@xpand/core", "@xpand/ui"],
  // The root `pnpm lint` (ESLint flat config of the monorepo) lints this app; `next build` must not lint it again
  // with a configuration it does not fully understand.
  eslint: { ignoreDuringBuilds: true },
  // Basic security headers on every response. A CSP is pending (ledger): it needs the inline scripts of Next
  // and the third parties (when enabled) enumerated.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  images: {
    // /_next/image fetches only from these hosts: just the avatar host of the Google provider (lh3, not any
    // subdomain of googleusercontent.com, which also hosts third-party content), and only when Google sign-in is
    // configured. Read at build time: the release (standalone) keeps what its build saw. Today the avatar is a plain
    // <img> (Radix Avatar), so nothing uses it yet.
    remotePatterns:
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? [{ protocol: "https", hostname: "lh3.googleusercontent.com" }]
        : [],
  },
};

module.exports = nextConfig;
