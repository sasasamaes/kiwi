const { buildSecurityHeaders } = require('../../packages/ui/security-headers.cjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@kiwi/ui', '@kiwi/types'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  eslint: {
    // Lint runs separately (npm run lint); pre-existing violations were blocking deploys
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        // Dashboard admin/merchant: no usa geolocation del navegador.
        headers: buildSecurityHeaders({
          allowGeolocation: false,
          apiOrigin: process.env.NEXT_PUBLIC_API_URL
            ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
            : undefined,
        }),
      },
    ];
  },
};

module.exports = nextConfig;
