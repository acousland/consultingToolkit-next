const nextConfig = {
  output: 'export',
  trailingSlash: true,
  distDir: 'out',
  images: {
    unoptimized: true
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Exclude API routes from static export
  generateBuildId: async () => {
    return 'electron-build'
  },
};

module.exports = nextConfig;
