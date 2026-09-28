// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
const { buildSecurityHeaders } = require('../../packages/ui/security-headers.cjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@kiwi/ui', '@kiwi/types'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  eslint: {
    // Lint runs separately (npm run lint); pre-existing violations were blocking deploys
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        // Dominio canónico del panel: el host vercel.app redirige al propio.
        // Solo el host exacto de producción (los previews siguen vivos).
        // 307 temporal: pasar a permanent cuando el DNS esté estable.
        source: '/:path*',
        has: [{ type: 'host', value: 'kiwi-merchant.vercel.app' }],
        destination: 'https://negocios.kiwicr.express/:path*',
        permanent: false,
      },
    ];
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
      {
        // FCM background SW: sin caché + scope explícito para no desalojar
        // a otros workers. La CSP global ya permite https://www.gstatic.com
        // (importScripts del SW). Ver apps/driver para el detalle.
        source: '/firebase-messaging-sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
