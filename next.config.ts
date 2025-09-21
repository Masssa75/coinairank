import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    workerThreads: false,
    cpus: 1
  },
  output: 'standalone',
  outputFileTracingRoot: process.cwd()
};

export default nextConfig;
