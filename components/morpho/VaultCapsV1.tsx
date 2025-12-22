'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useVaultCaps } from '@/lib/hooks/useVaultCaps';
import { formatNumber } from '@/lib/format/number';
import { ExternalLink } from 'lucide-react';
import type { Address } from 'viem';

interface VaultCapsV1Props {
  vaultAddress: Address | string;
}

function formatMarketName(loanAsset: string, collateralAsset: string): string {
  return `${loanAsset}/${collateralAsset}`;
}

export function VaultCapsV1({ vaultAddress }: VaultCapsV1Props) {
  const { data, isLoading, error } = useVaultCaps(vaultAddress);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Caps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Caps</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load market caps: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (data.markets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Caps</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-slate-500 dark:text-slate-400">
            No market caps found for this vault.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Caps</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.markets.map((market) => {
          const marketName = formatMarketName(market.loanAsset.symbol, market.collateralAsset.symbol);
          const hasPending = (market.supplyQueueIndex !== null && market.supplyQueueIndex !== undefined) ||
                            (market.withdrawQueueIndex !== null && market.withdrawQueueIndex !== undefined);
          
          // Calculate utilization if we have both supply and cap
          const utilization = market.supplyCap && market.supplyAssets
            ? (market.supplyAssets / market.supplyCap) * 100
            : null;

          return (
            <div key={market.marketKey} className="border-b border-slate-200 dark:border-slate-700 pb-6 last:border-0 last:pb-0">
              <div className="space-y-4">
                {/* Market Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-sm font-medium">
                      {marketName}
                    </Badge>
                    {hasPending && (
                      <Badge variant="secondary" className="text-xs">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <a
                    href={`https://app.morpho.org/markets/${market.marketKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                  >
                    View Market <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {/* Cap Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Supply Cap
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {market.supplyCap !== null
                        ? formatNumber(market.supplyCap, { decimals: 2, style: 'currency' })
                        : 'Unlimited'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Current Supply
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {market.supplyAssetsUsd !== null
                        ? formatNumber(market.supplyAssetsUsd, { decimals: 2, style: 'currency' })
                        : market.supplyAssets !== null
                        ? formatNumber(market.supplyAssets, { decimals: 2 })
                        : 'N/A'}
                    </div>
                    {utilization !== null && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {utilization.toFixed(2)}% utilized
                      </div>
                    )}
                  </div>

                  {market.supplyQueueIndex !== null && market.supplyQueueIndex !== undefined && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Max In (Queue Position)
                      </div>
                      <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        #{market.supplyQueueIndex + 1}
                      </div>
                    </div>
                  )}

                  {market.withdrawQueueIndex !== null && market.withdrawQueueIndex !== undefined && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Max Out (Queue Position)
                      </div>
                      <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        #{market.withdrawQueueIndex + 1}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pending Status */}
                {hasPending && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                    <div className="text-xs font-medium text-amber-800 dark:text-amber-200">
                      ⚠️ This market has pending allocations in the queue
                    </div>
                    {market.supplyQueueIndex !== null && market.supplyQueueIndex !== undefined && (
                      <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        Supply queue position: {market.supplyQueueIndex + 1}
                      </div>
                    )}
                    {market.withdrawQueueIndex !== null && market.withdrawQueueIndex !== undefined && (
                      <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        Withdraw queue position: {market.withdrawQueueIndex + 1}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

