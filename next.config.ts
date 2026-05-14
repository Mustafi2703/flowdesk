import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Avoid picking a parent monorepo lockfile when tracing files for serverless bundles.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
