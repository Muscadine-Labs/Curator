'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useVault } from '@/lib/hooks/useProtocolStats';
import { formatCompactUSD, formatPercentage, formatLtv, formatTokenAmount } from '@/lib/format/number';
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

  // Calculate total assets for percentage calculations (memoized)
  const totalAssets = useMemo(() => {
    return vault?.allocation?.reduce((sum, alloc) => {
      return sum + (alloc.supplyAssetsUsd ?? 0);
    }, 0) ?? 0;
  }, [vault?.allocation]);

  // Initialize allocations from vault data (useEffect for side effects)
  useEffect(() => {
    if (!vault?.allocation || allocations.size > 0) return;

    const initialAllocations = new Map<string, MarketAllocationInput>();
    const decimals = vault?.assetDecimals ?? 18;

    vault.allocation.forEach((alloc) => {
      if (!alloc.marketKey) return;

      let supplyAssets: bigint;
      if (typeof alloc.supplyAssets === 'string') {
        try {
          supplyAssets = BigInt(alloc.supplyAssets);
        } catch {
          supplyAssets = BigInt(0);
        }
      } else if (typeof alloc.supplyAssets === 'number') {
        supplyAssets = BigInt(Math.floor(alloc.supplyAssets));
      } else {
        supplyAssets = BigInt(0);
      }

      const formatMarketIdentifier = (
        loanSymbol: string | null | undefined,
        collateralSymbol: string | null | undefined
      ): string => {
        if (collateralSymbol && loanSymbol) return `${collateralSymbol}/${loanSymbol}`;
        if (loanSymbol) return loanSymbol;
        if (collateralSymbol) return collateralSymbol;
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
        isIdle: false,
        decimals,
        supplyApy: alloc.supplyApy ?? null,
        borrowApy: alloc.borrowApy ?? null,
        utilization: alloc.utilization ?? null,
        liquidityAssetsUsd: alloc.liquidityAssetsUsd ?? null,
      });
    });

    setAllocations(initialAllocations);
  }, [vault?.allocation, allocations.size]);

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

  const sortedAllocations = Array.from(allocations.values()).sort((a, b) => {
    const aAssets = Number(a.currentAssets);
    const bAssets = Number(b.currentAssets);
    if (aAssets !== bAssets) return bAssets - aAssets;
    if (a.isIdle && !b.isIdle) return 1;
    if (!a.isIdle && b.isIdle) return -1;
    return 0;
  });

  const fmt = (v: number | null | undefined) =>
    v != null && Number.isFinite(v) ? formatPercentage(v, 2) : '—';

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Allocation</CardTitle>
          <CardDescription>
            Total allocated: {formatCompactUSD(totalAssets)}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Market</TableHead>
                <TableHead className="text-right">Utilization</TableHead>
                <TableHead className="text-right">Liquidity</TableHead>
                <TableHead className="text-right">Borrow APY</TableHead>
                <TableHead className="text-right">Supply APY</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">% Allocated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAllocations.map((alloc) => {
                const pct = totalAssets > 0 ? (alloc.currentAssetsUsd / totalAssets) * 100 : 0;
                return (
                  <TableRow
                    key={alloc.uniqueKey}
                    className={cn(alloc.isIdle && 'opacity-75')}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`https://app.morpho.org/base/market/${alloc.uniqueKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:text-blue-600 dark:hover:text-blue-400 underline decoration-1 underline-offset-2"
                          >
                            {alloc.marketName}
                          </a>
                          {(alloc.isIdle || formatLtv(alloc.lltv) === '—') && (
                            <Badge variant="outline" className="text-xs">
                              Idle
                            </Badge>
                          )}
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {formatLtv(alloc.lltv) === '—' ? 'Idle' : `LTV ${formatLtv(alloc.lltv)}`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{fmt(alloc.utilization)}</TableCell>
                    <TableCell className="text-right">
                      {alloc.liquidityAssetsUsd != null && Number.isFinite(alloc.liquidityAssetsUsd)
                        ? formatCompactUSD(alloc.liquidityAssetsUsd)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">{fmt(alloc.borrowApy)}</TableCell>
                    <TableCell className="text-right">{fmt(alloc.supplyApy)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span>
                          {formatTokenAmount(alloc.currentAssets, alloc.decimals, 2)}{' '}
                          {alloc.loanAssetSymbol || ''}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatCompactUSD(alloc.currentAssetsUsd)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {totalAssets > 0 ? `${pct.toFixed(2)}%` : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
