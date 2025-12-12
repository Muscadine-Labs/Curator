'use client';

import { QueryClient } from '@tanstack/react-query';
import { createConfig, http, createStorage } from 'wagmi';
import { base } from 'viem/chains';
import { QUERY_STALE_TIME_MEDIUM } from '@/lib/constants';

// Create storage for persisting wallet connection state
// Uses localStorage to persist connection across page refreshes
const storage = createStorage({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'wagmi',
});

// Create wagmi config
const config = createConfig({
  chains: [base],
  ssr: true,
  storage,
  transports: {
    [base.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
        ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
        : `https://base-mainnet.g.alchemy.com/v2/demo` // Fallback for build
    ),
  },
});

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME_MEDIUM,
      refetchOnWindowFocus: false,
    },
  },
});

export { config, queryClient };
