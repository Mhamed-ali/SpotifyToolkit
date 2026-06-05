import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LocalTunnel host so Next.js doesn't block JS chunks/HMR (which breaks hydration)
  // @ts-ignore - Internal dev flag
  allowedDevOrigins: ['spotify-toolkit-dev.loca.lt'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.scdn.co' },
      { protocol: 'https', hostname: 'mosaic.scdn.co' },
    ],
  },
};

export default nextConfig;
