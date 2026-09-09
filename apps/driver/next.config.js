/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      // Real API host (was api.kiwi.app, which doesn't exist → rule never hit).
      // Short TTL: these GETs can be authenticated, so a 24h cache risks
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
});

const nextConfig = {
  transpilePackages: ['@kiwi/ui', '@kiwi/types'],
  eslint: {
    // Pre-existing lint issues; lint runs locally, skip during prod builds
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

module.exports = withPWA(nextConfig);
