import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: new URL('..', import.meta.url).pathname,
  // The repository root ESLint config targets plain Node.js files. Docs content and
  // TSX are type-checked by Next; keep linting out of the production build.
  eslint: { ignoreDuringBuilds: true },
};

export default withMDX(config);
