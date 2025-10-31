'use client';

import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { config, queryClient } from '@/lib/wallet/config';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'viem/chains';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export function Providers({ children }: { children: ReactNode }) {
  const onchainApiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;
  
  // Always wrap with WagmiProvider and QueryClientProvider first
  // Then conditionally add OnchainKitProvider if API key is available
  const innerContent = (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );

  return (
    <WagmiProvider config={config}>
      {onchainApiKey ? (
        <OnchainKitProvider apiKey={onchainApiKey} chain={base}>
          {innerContent}
        </OnchainKitProvider>
      ) : (
        innerContent
      )}
    </WagmiProvider>
  );
}
