import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore - Internal dev flag
  allowedDevOrigins: ['localhost:3000', '127.0.0.1:3000', '127.0.0.1'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.scdn.co' },
      { protocol: 'https', hostname: 'mosaic.scdn.co' },
    ],
  },
};

export default nextConfig;
