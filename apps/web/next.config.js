/** @type {import('next').NextConfig} */
const nextConfig = {
  // The root `pnpm lint` (ESLint flat config of the monorepo) lints this app; `next build` must not lint it again
  // with a configuration it does not fully understand.
  eslint: { ignoreDuringBuilds: true },
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
