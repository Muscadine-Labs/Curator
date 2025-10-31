'use client';

import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { config, queryClient } from '@/lib/wallet/config';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'viem/chains';

export function Providers({ children }: { children: ReactNode }) {
  const onchainApiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;
  
  // If OnchainKit API key is provided, use OnchainKitProvider which includes wagmi and query client
  // Otherwise, use our custom wagmi setup
  if (onchainApiKey) {
    return (
      <OnchainKitProvider apiKey={onchainApiKey} chain={base}>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </WagmiProvider>
      </OnchainKitProvider>
    );
  }
  
  // Fallback to custom setup if OnchainKit API key is not provided
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
