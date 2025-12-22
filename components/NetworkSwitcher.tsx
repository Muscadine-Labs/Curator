'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAccount, useChainId, useSwitchChain, useBlockNumber } from 'wagmi';
import { base, mainnet, optimism, polygon } from 'viem/chains';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function NetworkSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  
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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSwitchChain = (targetChainId: number) => {
    if (targetChainId === chainId) {
      setIsOpen(false);
      return;
    }

    if (isConnected) {
      switchChain({ chainId: targetChainId });
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:flex sm:gap-2 sm:px-3"
        disabled={isPending}
      >
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
        <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="p-1">
            {chains.map(({ chain, label }) => {
              const isActive = chain.id === chainId;
              return (
                <button
                  key={chain.id}
                  onClick={() => handleSwitchChain(chain.id)}
                  className={cn(
                    'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                    isActive
                      ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
                    isPending && 'opacity-50 cursor-not-allowed'
                  )}
                  disabled={isPending || isActive}
                >
                  <div className="flex items-center justify-between">
                    <span>{label}</span>
                    {isActive && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

