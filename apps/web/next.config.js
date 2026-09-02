/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@delivery/ui', '@delivery/types', '@delivery/db'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

module.exports = nextConfig;
