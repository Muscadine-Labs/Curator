'use client';

import { useAccount, useChainId, useBlockNumber } from 'wagmi';
import { base, mainnet, optimism, polygon } from 'viem/chains';
import { useQuery } from '@tanstack/react-query';

const chains = [
  { chain: base, label: 'Base' },
  { chain: mainnet, label: 'Ethereum' },
  { chain: optimism, label: 'Optimism' },
  { chain: polygon, label: 'Polygon' },
];

// Simple health check for GraphQL API
async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch('/api/morpho-markets?limit=1', {
      credentials: 'omit',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function NetworkSwitcher() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  
  // Check blockchain connectivity
  const { isError: isBlockchainError } = useBlockNumber({
    chainId,
    query: {
      retry: 1,
      retryDelay: 1000,
      refetchInterval: 30000, // Check every 30 seconds
    },
  });

  // Check API/data connectivity
  const { data: isApiHealthy, isError: isApiError } = useQuery({
    queryKey: ['api-health'],
    queryFn: checkApiHealth,
    refetchInterval: 30000, // Check every 30 seconds
    retry: 1,
    retryDelay: 1000,
  });

  const currentChain = chains.find((c) => c.chain.id === chainId) || chains[0];
  
  // Determine connection status
  const hasConnectionIssue = isBlockchainError || isApiError || isApiHealthy === false;

  return (
    <div className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 sm:flex sm:gap-2 sm:px-3">
      {(() => {
        if (hasConnectionIssue) {
          return <span className="h-2 w-2 rounded-full bg-red-500" title="Connection issue detected" />;
        }
        if (isConnected) {
          return <span className="h-2 w-2 rounded-full bg-emerald-500" title="Connected" />;
        }
        return <span className="h-2 w-2 rounded-full bg-slate-400" title="Not connected" />;
      })()}
      <span className="hidden sm:inline">{currentChain.label} • </span>
      <span>{currentChain.chain.name}</span>
    </div>
  );
}

