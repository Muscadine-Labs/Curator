'use client';

import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wallet/config';
import { QUERY_STALE_TIME_MEDIUM } from '@/lib/constants';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useEffect } from 'react';

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
  
  // #region agent log
  useEffect(() => {
    // Monitor fetch errors for Web3Modal API calls
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      let url = '';
      if (typeof args[0] === 'string') {
        url = args[0];
      } else if (args[0] instanceof Request) {
        url = args[0].url;
      } else if (args[0] instanceof URL) {
        url = args[0].toString();
      }
      if (url.includes('web3modal.org') || url.includes('appkit')) {
        fetch('http://127.0.0.1:7242/ingest/12c6e062-52e2-470f-b399-c937a41c73e1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/providers.tsx:25',message:'Web3Modal fetch detected',data:{url,method:args[1]?.method || 'GET'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        return originalFetch.apply(this, args).then(response => {
          if (!response.ok) {
            fetch('http://127.0.0.1:7242/ingest/12c6e062-52e2-470f-b399-c937a41c73e1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/providers.tsx:28',message:'Web3Modal fetch failed',data:{url,status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          }
          return response;
        }).catch(error => {
          fetch('http://127.0.0.1:7242/ingest/12c6e062-52e2-470f-b399-c937a41c73e1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/providers.tsx:33',message:'Web3Modal fetch error',data:{url,error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          throw error;
        });
      }
      return originalFetch.apply(this, args);
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, []);
  // #endregion
  
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
