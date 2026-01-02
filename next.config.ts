import type { NextConfig } from "next";

// Auto-populate NEXT_PUBLIC_ALCHEMY_API_KEY from ALCHEMY_API_KEY if not set
// This allows using the same key for both server and client without duplicating it
if (!process.env.NEXT_PUBLIC_ALCHEMY_API_KEY && process.env.ALCHEMY_API_KEY) {
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
}

// Build env object conditionally - only include NEXT_PUBLIC_ALCHEMY_API_KEY if it's set
const envConfig: Record<string, string> = {};
const alchemyPublicKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY;
if (alchemyPublicKey) {
  envConfig.NEXT_PUBLIC_ALCHEMY_API_KEY = alchemyPublicKey;
}

const nextConfig: NextConfig = {
  // Expose environment variables to the client
  // This ensures NEXT_PUBLIC_ALCHEMY_API_KEY is available at runtime in production
  // Auto-populated from ALCHEMY_API_KEY if NEXT_PUBLIC_ALCHEMY_API_KEY is not explicitly set
  env: envConfig,
  // Use webpack for builds to support alias configuration
  // Turbopack doesn't support false aliases yet
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
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react', '@radix-ui/react-tabs'],
  },
};

export default nextConfig;
