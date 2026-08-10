import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required by the multi-stage Dockerfile (.next/standalone build).
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // Next.js 16 buffers request bodies through proxy (default 10MB) and silently
  // truncates larger multipart uploads — raise to cover the 100MB doc limit.
  experimental: {
    proxyClientMaxBodySize: '110mb',
  },
}

export default nextConfig
