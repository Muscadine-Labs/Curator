'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

const ReactQueryDevtools = dynamic(
  () => import('@tanstack/react-query-devtools').then((mod) => mod.ReactQueryDevtools),
  { ssr: false }
);
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wallet/config';
import { useTheme } from '@/lib/theme/ThemeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CuratorAuthProvider } from '@/lib/auth/CuratorAuthContext';
import { ThemeProvider } from '@/lib/theme/ThemeContext';
import { RevenueSourceProvider } from '@/lib/RevenueSourceContext';

// Create QueryClient at module level for build-time availability
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function resolveDark(theme: 'light' | 'dark' | 'system'): boolean {
  if (typeof window === 'undefined') return false;
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function RainbowKitWithTheme({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  // Keep resolvedDark false on server and first client render to avoid hydration mismatch:
  // resolveDark() uses window/matchMedia, which differ between server and client when theme is 'system'.
  const [resolvedDark, setResolvedDark] = useState(false);

  useEffect(() => {
    const update = () => setResolvedDark(resolveDark(theme));
    update();
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
  }, [theme]);

  return <RainbowKitProvider theme={resolvedDark ? darkTheme() : lightTheme()}>{children}</RainbowKitProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  // Provider order:
  // 1. QueryClientProvider (required for React Query hooks - must be outermost for static generation)
  // 2. ThemeProvider (theme for app + RainbowKit modal)
  // 3. WagmiProvider (required for all wallet functionality)
  // 4. RainbowKitProvider (enhances wallet UX with modal; theme synced to app light/dark)
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <WagmiProvider config={config} reconnectOnMount>
          <RainbowKitWithTheme>
            <CuratorAuthProvider>
              <RevenueSourceProvider>
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </RevenueSourceProvider>
            </CuratorAuthProvider>
            {process.env.NODE_ENV === 'development' && (
              <ReactQueryDevtools initialIsOpen={false} />
            )}
          </RainbowKitWithTheme>
        </WagmiProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
