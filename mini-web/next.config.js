const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  // This app is a tiny standalone consumer of the Peak SDK; its own lint gate is
  // `tsc --noEmit`. Skipping the inherited monorepo ESLint config avoids the
  // root config parsing this app's TS/JSX with the wrong parser.
  eslint: { ignoreDuringBuilds: true },
  // The monorepo has several lockfiles; pin tracing to this app.
  outputFileTracingRoot: path.join(__dirname),
  // Allow the player origin to be configured via env
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787',
    NEXT_PUBLIC_PLAYER_URL: process.env.NEXT_PUBLIC_PLAYER_URL || 'http://localhost:3011',
  },
};

module.exports = nextConfig;
