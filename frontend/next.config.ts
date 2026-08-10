import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required by the multi-stage Dockerfile (.next/standalone build).
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // Next.js 16 buffers request bodies through proxy/middleware (default 10MB).
  // Spec allows brand/task docs up to 100MB — raise so uploads are not truncated.
  experimental: {
    proxyClientMaxBodySize: '110mb',
    middlewareClientMaxBodySize: '110mb',
  },
  serverActions: {
    bodySizeLimit: '110mb',
  },
}

export default nextConfig
