import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Silence optional deps required by walletconnect/metamask in browser builds
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'pino-pretty': false,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
};

export default nextConfig;
