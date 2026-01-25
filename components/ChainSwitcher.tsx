'use client';

import { useEffect, useRef, useState } from 'react';
import { useChainId, useSwitchChain } from 'wagmi';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CHAIN_LABELS: Record<number, string> = {
  8453: 'Base',
  1: 'Ethereum',
  10: 'Optimism',
  137: 'Polygon',
};

export function ChainSwitcher() {
  const chainId = useChainId();
  const { chains, switchChain, isPending } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (hostRef.current && !hostRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const currentLabel = CHAIN_LABELS[chainId] ?? chains.find((c) => c.id === chainId)?.name ?? 'Unknown';

  return (
    <div className="relative" ref={hostRef}>
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] w-full touch-manipulation justify-between gap-2 font-normal"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
      >
        <span className="truncate">{currentLabel}</span>
        {isPending ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" />
        ) : (
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </Button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {chains.map((chain) => {
            const label = CHAIN_LABELS[chain.id] ?? chain.name;
            const isCurrent = chain.id === chainId;
            const isSwitching = isPending && isCurrent;
            return (
              <button
                key={chain.id}
                type="button"
                className="flex min-h-[44px] w-full touch-manipulation items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => {
                  if (chain.id !== chainId) {
                    switchChain({ chainId: chain.id });
                  }
                  setOpen(false);
                }}
                disabled={isCurrent}
              >
                <span className={isCurrent ? 'font-medium' : ''}>{label}</span>
                {isSwitching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
