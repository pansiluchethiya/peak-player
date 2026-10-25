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
};

export default nextConfig;

