import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Avoid failing production builds on lint errors
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
