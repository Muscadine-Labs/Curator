'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { config, queryClient } from '@/lib/wallet/config';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'viem/chains';

export function Providers({ children }: { children: React.ReactNode }) {
  const onchainApiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;
  return (
    <WagmiProvider config={config}>
      {onchainApiKey ? (
        <OnchainKitProvider apiKey={onchainApiKey} chain={base}>
          <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </OnchainKitProvider>
      ) : (
        <QueryClientProvider client={queryClient}>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      )}
    </WagmiProvider>
  );
}
