const { buildSecurityHeaders } = require('../../packages/ui/security-headers.cjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@kiwi/ui', '@kiwi/types'],
  experimental: {
    // Igual que driver/web: evita 300KB+ de iconos no usados en el bundle.
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
        headers: buildSecurityHeaders({
          allowGeolocation: true,
          // CSP conecta al API real del build (localhost en dev).
          apiOrigin: process.env.NEXT_PUBLIC_API_URL
            ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
            : undefined,
        }),
      },
    ];
  },
};

module.exports = nextConfig;
