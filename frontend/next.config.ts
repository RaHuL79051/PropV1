import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    // BACKEND_URL is set in Vercel to the deployed backend origin
    // (e.g. https://proptenant-backend.onrender.com). Locally, .env leaves it
    // unset and it falls back to the dev server on port 5000.
    const backendOrigin = process.env.BACKEND_URL || 'http://localhost:5000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin.replace(/\/+$/, '')}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
