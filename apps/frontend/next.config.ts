import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only use static export for Electron production build
  ...(process.env.NODE_ENV === 'production' && {
    output: 'export',
    trailingSlash: true,
    images: {
      unoptimized: true
    },
  }),
  eslint: {
    // Avoid failing production builds on lint errors
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
