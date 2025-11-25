'use client';

import { QueryClient } from '@tanstack/react-query';
import { createConfig, http } from 'wagmi';
import { base } from 'viem/chains';
import { QUERY_STALE_TIME_MEDIUM } from '@/lib/constants';

// Create wagmi config
const config = createConfig({
  chains: [base],
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
