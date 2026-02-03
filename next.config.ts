import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: [
    '@uniswap/v4-sdk',
    '@uniswap/universal-router-sdk',
    '@uniswap/sdk-core',
    '@uniswap/v3-sdk',
    'jsbi',
  ],
};

export default nextConfig;
