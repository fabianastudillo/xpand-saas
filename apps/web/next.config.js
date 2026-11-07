/** @type {import('next').NextConfig} */
const nextConfig = {
  // The interface version (the status bar compares it with the platform's, /api/config): this package's.
  // The «N» badge of `next dev` would sit on top of the visual baselines (tests/ide, @visual).
  devIndicators: false,
  // Only for the test that starts a second server without a database (tests/ide/sin-postgres.spec.ts), which must not
  // share the build folder of the first.
  distDir: process.env.XPAND_DIST_DIR || ".next",
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
    // Only the avatar host of the Google provider; everything else is served from public/.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**googleusercontent.com",
      },
    ],
  },
};

module.exports = nextConfig;
