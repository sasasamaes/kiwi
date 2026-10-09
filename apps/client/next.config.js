// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/** PWA instalable (igual que driver): precache de shell + runtime solo
 *  estático. El API NUNCA se cachea (datos por usuario). */
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
          },
        },
      },
      {
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'images',
          expiration: {
            maxEntries: 60,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
        },
      },
      {
        urlPattern: /\.(?:js|css)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-resources',
        },
      },
    ],
  },
});

const { buildSecurityHeaders } = require('../../packages/ui/security-headers.cjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@kiwi/ui', '@kiwi/types'],
  experimental: {
    // Igual que driver/web: evita 300KB+ de iconos no usados en el bundle.
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  eslint: {
    // Lint runs separately (npm run lint); pre-existing violations were blocking deploys
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        // Dominio canónico del menú QR: el host vercel.app redirige al propio.
        // Solo el host exacto de producción (los previews siguen vivos).
        // 307 temporal: pasar a permanent cuando el DNS esté estable.
        source: '/:path*',
        has: [{ type: 'host', value: 'kiwi-client-tau.vercel.app' }],
        destination: 'https://www.kiwicr.express/:path*',
        permanent: false,
      },
    ];
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
      {
        // El service worker NO se cachea con heurísticas del navegador:
        // max-age=0 garantiza que los updates de la PWA se detecten al vuelo.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
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

module.exports = withPWA(nextConfig);
