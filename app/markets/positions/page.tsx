'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { MarketPositionBox } from '@/components/morpho/MarketPositionBox';
import { Skeleton } from '@/components/ui/skeleton';

function PositionsContent() {
  const searchParams = useSearchParams();
  const initialMarketId = searchParams.get('market') ?? undefined;
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
