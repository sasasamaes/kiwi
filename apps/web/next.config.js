/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@kiwi/ui', '@kiwi/types', '@kiwi/db'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  eslint: {
    // Lint runs separately (npm run lint); pre-existing violations were blocking deploys
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
