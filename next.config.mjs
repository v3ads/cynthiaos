import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
  distDir: process.env.DIST_DIR || '.next',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },



  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 60,
  },

  // Root routing is handled by middleware (src/middleware.ts): unauthenticated
  // requests to '/' go to /login, authenticated requests go to /today. A
  // config-level redirect here would run at the edge BEFORE middleware and
  // bypass auth, so it is intentionally omitted.

  webpack(config) {
    config.module.rules.push({
      test: /\.(jsx|tsx)$/,
      exclude: [/node_modules/],
      use: [{ loader: '@dhiwise/component-tagger/nextLoader' }],
    });
    return config;
  }
};
export default nextConfig;