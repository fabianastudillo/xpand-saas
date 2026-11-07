/** @type {import('next').NextConfig} */
const nextConfig = {
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
