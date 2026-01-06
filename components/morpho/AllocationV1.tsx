'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useVault } from '@/lib/hooks/useProtocolStats';
import { formatAllocationAmount } from '@/lib/onchain/allocation-utils';
import { formatCompactUSD, formatPercentage } from '@/lib/format/number';
import { cn } from '@/lib/utils';

interface AllocationV1Props {
  vaultAddress: string;
}

interface MarketAllocationInput {
  uniqueKey: string;
  marketName: string;
  loanAssetAddress?: string | null;
  loanAssetSymbol?: string | null;
  collateralAssetAddress?: string | null;
  collateralAssetSymbol?: string | null;
  oracleAddress?: string | null;
  irmAddress?: string | null;
  lltv?: number | null;
  currentAssets: bigint;
  currentAssetsUsd: number;
  isIdle: boolean;
  decimals: number;
  supplyApy?: number | null;
  borrowApy?: number | null;
  utilization?: number | null;
  liquidityAssetsUsd?: number | null;
}

export function AllocationV1({ vaultAddress }: AllocationV1Props) {
  const { data: vault, isLoading, error } = useVault(vaultAddress);
  const [allocations, setAllocations] = useState<Map<string, MarketAllocationInput>>(new Map());

  // Calculate total assets for percentage calculations
  const totalAssets = vault?.allocation?.reduce((sum, alloc) => {
    return sum + (alloc.supplyAssetsUsd ?? 0);
  }, 0) ?? 0;

  // Initialize allocations from vault data
  useMemo(() => {
    if (!vault?.allocation || allocations.size > 0) return;

    const initialAllocations = new Map<string, MarketAllocationInput>();
    // Get decimals from vault asset (default to 18 if not available)
    const decimals = vault?.assetDecimals ?? 18;
    
    vault.allocation.forEach((alloc) => {
      if (!alloc.marketKey) return;
      
      // supplyAssets comes as a string from GraphQL (raw wei amount)
      // If it's a number, it might be in USD or wei - we'll treat it as wei
      let supplyAssets: bigint;
      if (typeof alloc.supplyAssets === 'string') {
        try {
          supplyAssets = BigInt(alloc.supplyAssets);
        } catch {
          supplyAssets = BigInt(0);
        }
      } else if (typeof alloc.supplyAssets === 'number') {
        // If it's a number, assume it's already in wei (or convert if needed)
        supplyAssets = BigInt(Math.floor(alloc.supplyAssets));
      } else {
        supplyAssets = BigInt(0);
      }
      
      // Format market identifier using symbols (like MarketRiskV1)
      const formatMarketIdentifier = (
        loanSymbol: string | null | undefined,
        collateralSymbol: string | null | undefined
      ): string => {
        if (collateralSymbol && loanSymbol) {
          return `${collateralSymbol}/${loanSymbol}`;
        }
        if (loanSymbol) {
          return loanSymbol;
        }
        if (collateralSymbol) {
          return collateralSymbol;
        }
        return 'Unknown Market';
      };

      initialAllocations.set(alloc.marketKey, {
        uniqueKey: alloc.marketKey,
        marketName: formatMarketIdentifier(alloc.loanAssetSymbol, alloc.collateralAssetSymbol),
        loanAssetAddress: alloc.loanAssetAddress ?? null,
        loanAssetSymbol: alloc.loanAssetSymbol ?? null,
        collateralAssetAddress: alloc.collateralAssetAddress ?? null,
        collateralAssetSymbol: alloc.collateralAssetSymbol ?? null,
        oracleAddress: alloc.oracleAddress ?? null,
        irmAddress: alloc.irmAddress ?? null,
        lltv: alloc.lltv ?? null,
        currentAssets: supplyAssets,
        currentAssetsUsd: alloc.supplyAssetsUsd ?? 0,
        isIdle: false, // TODO: detect idle market
        decimals,
        supplyApy: alloc.supplyApy ?? null,
        borrowApy: alloc.borrowApy ?? null,
        utilization: alloc.utilization ?? null,
        liquidityAssetsUsd: alloc.liquidityAssetsUsd ?? null,
      });
    });

    setAllocations(initialAllocations);
  }, [vault, allocations.size]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Allocation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load allocation data: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!vault || !vault.allocation || vault.allocation.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-slate-500 dark:text-slate-400">
            No allocation data available
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort allocations similar to MarketRiskV1:
  // 1. Sort by current allocation (descending - highest first)
  // 2. If allocation is the same, idle markets go last
  const sortedAllocations = Array.from(allocations.values()).sort((a, b) => {
    const aAssets = Number(a.currentAssets);
    const bAssets = Number(b.currentAssets);
    
    // First, sort by current allocation (descending)
    if (aAssets !== bAssets) {
      return bAssets - aAssets;
    }
    
    // If allocation is the same, put idle markets last
    if (a.isIdle && !b.isIdle) {
      return 1; // a goes after b
    }
    if (!a.isIdle && b.isIdle) {
      return -1; // a goes before b
    }
    
    // Both idle or both not idle - maintain current order
    return 0;
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Allocation</CardTitle>
          <CardDescription>
            View vault allocations across markets
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
          <div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total Allocated</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {formatCompactUSD(totalAssets)}
            </p>
          </div>
        </div>

        {/* Allocation Table */}
        <div className="space-y-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          <div className="grid grid-cols-12 gap-2 sm:gap-4 p-2 text-xs font-medium text-slate-600 dark:text-slate-400 border-b min-w-[800px]">
            <div className="col-span-3">Market</div>
            <div className="col-span-7 text-right">Current</div>
            <div className="col-span-2 text-right">Market Info</div>
          </div>

          {sortedAllocations.map((alloc) => {
            const currentPercent = totalAssets > 0 
              ? (alloc.currentAssetsUsd / totalAssets) * 100 
              : 0;

            return (
              <div
                key={alloc.uniqueKey}
                className={cn(
                  "grid grid-cols-12 gap-2 sm:gap-4 p-3 rounded-lg border min-w-[800px]",
                  alloc.isIdle 
                    ? "bg-slate-100/50 dark:bg-slate-800/50 opacity-75" 
                    : "bg-white dark:bg-slate-900"
                )}
              >
                {/* Left: Market name and LTV */}
                <div className="col-span-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`https://app.morpho.org/base/market/${alloc.uniqueKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors underline decoration-1 underline-offset-2 break-words"
                    >
                      {alloc.marketName}
                    </a>
                    {alloc.isIdle && (
                      <Badge variant="outline" className="text-xs">
                        Idle
                      </Badge>
                    )}
                    {(!alloc.loanAssetAddress || !alloc.collateralAssetAddress || !alloc.oracleAddress || !alloc.irmAddress || alloc.lltv === null || alloc.lltv === undefined) && (
                      <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                        Missing Data
                      </Badge>
                    )}
                  </div>
                  {alloc.lltv !== null && alloc.lltv !== undefined ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      LTV:{' '}
                      {(() => {
                        const n = Number(alloc.lltv);
                        if (!Number.isFinite(n)) return 'N/A';
                        if (n > 1_000_000) return `${(n / 1e18).toFixed(2)}%`;
                        if (n <= 1) return `${(n * 100).toFixed(2)}%`;
                        return `${n.toFixed(2)}%`;
                      })()}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      LTV: Not available
                    </p>
                  )}
                </div>
                
                {/* Middle: Current allocation */}
                <div className="col-span-7 text-right">
                  <p className="text-xs sm:text-sm font-medium break-words">
                    {formatAllocationAmount(alloc.currentAssets, alloc.decimals)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatCompactUSD(alloc.currentAssetsUsd)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {currentPercent.toFixed(2)}%
                  </p>
                </div>
                
                {/* Right: Market info (Utilization, Liquidity, Borrow APY, Supply APY) */}
                <div className="col-span-2 text-right space-y-1">
                  {alloc.utilization !== null && alloc.utilization !== undefined && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Utilization: {formatPercentage(alloc.utilization, 2)}
                    </p>
                  )}
                  {alloc.liquidityAssetsUsd !== null && alloc.liquidityAssetsUsd !== undefined && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Liquidity: {formatCompactUSD(alloc.liquidityAssetsUsd)}
                    </p>
                  )}
                  {alloc.borrowApy !== null && alloc.borrowApy !== undefined && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Borrow APY: {formatPercentage(alloc.borrowApy, 2)}
                    </p>
                  )}
                  {alloc.supplyApy !== null && alloc.supplyApy !== undefined && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Supply APY: {formatPercentage(alloc.supplyApy, 2)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

