'use client';

import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

const ReactQueryDevtools = dynamic(
  () => import('@tanstack/react-query-devtools').then((mod) => mod.ReactQueryDevtools),
  { ssr: false }
);
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wallet/config';
import { QUERY_STALE_TIME_MEDIUM } from '@/lib/constants';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Create QueryClient at module level for build-time availability
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Always refetch on mount/refresh - data is immediately stale
      refetchOnWindowFocus: false,
      refetchOnMount: true, // Refetch when component mounts (on page refresh)
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
          {process.env.NODE_ENV === 'development' && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
