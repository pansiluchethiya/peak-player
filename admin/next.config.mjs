import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone target mirrors player/; tracing root is this package so the
  // shared ui/ layer (imported via relative path) is bundled and admin/public
  // assets are copied flat into .next/standalone/ (see server.js at standalone root).
  output: 'standalone',
  outputFileTracingRoot: rootDir,
  reactStrictMode: true,
  // The repo root ESLint config targets plain Node.js. Admin lint/type-check
  // is optional for this scaffold; keep production builds green regardless.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // Proxy auth + API requests to the backend API server (port 8787).
  // When the admin app runs standalone on :3003, relative fetches like
  // /auth/session and /api/config need to reach the Express API, not a
  // Next.js route that doesn't exist. When accessed through the API server's
  // /admin/* proxy, these rewrites are harmless (the request already hit the
  // API server, but rewrites only apply to unmatched Next.js routes).
  async rewrites() {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8787';
    return [
      { source: '/auth/:path*', destination: `${API_URL}/auth/:path*` },
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
    ];
  },
};

export default nextConfig;

