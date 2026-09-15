/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    // NOTE (@ducanh2912/next-pwa): custom rules live under workboxOptions,
    // not top-level (v5 accepted top-level runtimeCaching).
    runtimeCaching: [
      {
        // Real API host: https://kiwi-api-fe54.onrender.com/api
        // Short TTL: these GETs can be authenticated, so a long cache risks
        // stale cross-user data on shared devices.
        urlPattern: (() => {
          try {
            const origin = new URL(
              process.env.NEXT_PUBLIC_API_URL || 'https://kiwi-api-fe54.onrender.com/api',
            ).origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(`^${origin}/.*`, 'i');
          } catch {
            return /^https:\/\/kiwi-api-fe54\.onrender\.com\/.*/i;
          }
        })(),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 5, // 5 minutes
          },
          networkTimeoutSeconds: 10,
        },
      },
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

const nextConfig = {
  transpilePackages: ['@kiwi/ui', '@kiwi/types'],
  eslint: {
    // Pre-existing lint issues; lint runs locally, skip during prod builds
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        // Driver app: sí usa geolocation (ubicación en vivo del repartidor).
        headers: buildSecurityHeaders({
          allowGeolocation: true,
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
    ];
  },
};

module.exports = withPWA(nextConfig);
