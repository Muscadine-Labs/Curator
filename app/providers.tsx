'use client';

import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config, queryClient } from '@/lib/wallet/config';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export function Providers({ children }: { children: ReactNode }) {
  // Provider order:
  // 1. WagmiProvider (required for all wallet functionality)
  // 2. RainbowKitProvider (enhances wallet UX with modal and wallet options)
  // 3. QueryClientProvider (required for React Query hooks)
  const appContent = (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );

  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider>
        {appContent}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
