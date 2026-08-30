'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { ArrowDownUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { useUserMarketPositions } from '@/lib/hooks/useUserMarketPositions';
import { useCuratorNetwork } from '@/lib/network/CuratorNetworkContext';
import { formatAllocationEditInputExact } from '@/lib/format/allocation-display';
import { curatorBlueMarketHref } from '@/lib/morpho/morpho-app-links';

export function WalletMarketPositionsCard() {
  const { chainId, networkName } = useCuratorNetwork();
  const { address, isConnected } = useAccount();
  const { data: positions = [], isLoading } = useUserMarketPositions(address, chainId);

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>Your positions</span>
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link href="/markets/positions">
              <ArrowDownUp className="mr-1.5 h-3.5 w-3.5" />
              Supply / borrow
            </Link>
          </Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Supply, borrow, and collateral for this wallet on {networkName}. Deposit
          and withdraw from Positions.
        </p>
      </CardHeader>
      <CardContent>
        {!isConnected ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">Connect a wallet to see positions.</p>
            <ConnectWalletButton />
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Blue supply or borrow on this network.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-md border border-border/60">
            {positions.map((row) => {
              const href = `/markets/positions?market=${encodeURIComponent(row.marketId)}`;
              const marketHref = curatorBlueMarketHref(row.marketId, chainId);
              return (
                <li key={row.marketId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{row.pair}</p>
                    <p className="text-[11px] text-muted-foreground">
                      LLTV {row.lltvLabel}
                      {row.supplyAssets > 0n
                        ? ` · supply ${formatAllocationEditInputExact(row.supplyAssets, row.loanSymbol, row.loanDecimals, true)} ${row.loanSymbol}`
                        : ''}
                      {row.borrowAssets > 0n
                        ? ` · borrow ${formatAllocationEditInputExact(row.borrowAssets, row.loanSymbol, row.loanDecimals, true)} ${row.loanSymbol}`
                        : ''}
                      {row.collateral > 0n
                        ? ` · coll ${formatAllocationEditInputExact(row.collateral, row.collateralSymbol, row.collateralDecimals, true)} ${row.collateralSymbol}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {marketHref ? (
                      <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                        <Link href={marketHref}>Market</Link>
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="secondary" className="h-8 text-xs">
                      <Link href={href}>Manage</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
