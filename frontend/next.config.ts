import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required by the multi-stage Dockerfile (.next/standalone build).
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
}

export default nextConfig
