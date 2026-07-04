/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Next.js 15 features
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
