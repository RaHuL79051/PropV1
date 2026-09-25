import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // The Express backend now runs inline as a catch-all Pages API route
  // (src/pages/api/[...path].ts), so /api/* requests are handled locally by
  // Next.js on the same origin. No rewrite / no BACKEND_URL needed.
  serverExternalPackages: ['@prisma/client', 'prisma', 'bcrypt', 'pdfkit'],
};

export default nextConfig;
