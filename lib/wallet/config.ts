'use client';

import { QueryClient } from '@tanstack/react-query';
import { createConfig, http } from 'wagmi';
import { base } from 'viem/chains';

// Create wagmi config
const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(`https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
  },
});

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

export { config, queryClient };
