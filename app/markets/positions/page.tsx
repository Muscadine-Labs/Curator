'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { MarketPositionBox } from '@/components/morpho/MarketPositionBox';
import { Skeleton } from '@/components/ui/skeleton';
import { useCuratorNetwork } from '@/lib/network/CuratorNetworkContext';
import { parseCuratorMarketChainId } from '@/lib/constants';

function PositionsContent() {
  const searchParams = useSearchParams();
  const { setChainId, ready } = useCuratorNetwork();
  const initialMarketId = searchParams.get('market') ?? undefined;
  const chainIdParam = searchParams.get('chainId');
  const [chainSynced, setChainSynced] = useState(!chainIdParam);

  useEffect(() => {
    if (!ready) return;
    if (!chainIdParam) {
      setChainSynced(true);
      return;
    }
    setChainSynced(false);
    let cancelled = false;
    void setChainId(parseCuratorMarketChainId(chainIdParam)).finally(() => {
      if (!cancelled) setChainSynced(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, chainIdParam, setChainId]);

  if (!ready || !chainSynced) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <MarketPositionBox initialMarketId={initialMarketId} />
    </div>
  );
}

export default function MarketsPositionsPage() {
  return (
    <AppShell
      title="Market Positions"
      description="Your Blue positions, then borrow / repay / supply / collateral for a market."
      backHref="/markets"
      backLabel="Markets"
    >
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-3xl">
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        }
      >
        <PositionsContent />
      </Suspense>
    </AppShell>
  );
}
