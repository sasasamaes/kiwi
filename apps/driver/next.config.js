/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@kiwi/ui', '@kiwi/types', '@kiwi/db'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

module.exports = nextConfig;
