'use client';

import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wallet/config';
import { QUERY_STALE_TIME_MEDIUM } from '@/lib/constants';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Create QueryClient at module level for build-time availability
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME_MEDIUM,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  // Provider order:
  // 1. QueryClientProvider (required for React Query hooks - must be outermost for static generation)
  // 2. WagmiProvider (required for all wallet functionality)
  // 3. RainbowKitProvider (enhances wallet UX with modal and wallet options)
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <RainbowKitProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <ReactQueryDevtools initialIsOpen={false} />
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
