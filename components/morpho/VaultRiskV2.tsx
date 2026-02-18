'use client';

import { useMemo } from 'react';
import { Shield } from 'lucide-react';
import { useVaultV2Risk } from '@/lib/hooks/useVaultV2Risk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCompactUSD, formatPercentage } from '@/lib/format/number';
import type { MarketRiskGrade } from '@/lib/morpho/compute-v1-market-risk';
import { isMarketIdle } from '@/lib/morpho/compute-v1-market-risk';

interface VaultRiskV2Props {
  vaultAddress: string;
  preloadedData?: import('@/app/api/vaults/v2/[id]/risk/route').V2VaultRiskResponse | null;
}

function getGradeColor(grade: MarketRiskGrade): string {
  switch (grade) {
    case 'A+':
    case 'A':
    case 'A−':
      return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'B+':
    case 'B':
    case 'B−':
      return 'border-sky-500/30 bg-sky-500/15 text-sky-600 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-300';
    case 'C+':
    case 'C':
    case 'C−':
      return 'border-amber-500/30 bg-amber-500/15 text-amber-600 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300';
    case 'D':
      return 'border-orange-500/30 bg-orange-500/15 text-orange-600 dark:border-orange-400/20 dark:bg-orange-500/10 dark:text-orange-300';
    case 'F':
      return 'border-rose-500/30 bg-rose-500/15 text-rose-600 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300';
    default:
      return 'border-gray-500/30 bg-gray-500/15 text-gray-600 dark:border-gray-400/20 dark:bg-gray-500/10 dark:text-gray-300';
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-sky-600 dark:text-sky-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  if (score >= 20) return 'text-orange-600 dark:text-orange-400';
  return 'text-rose-600 dark:text-rose-400';
}

function formatMarketIdentifier(
  loanAsset: string | undefined,
  collateralAsset: string | undefined
): string {
  if (loanAsset && collateralAsset) return `${collateralAsset}/${loanAsset}`;
  if (loanAsset) return loanAsset;
  if (collateralAsset) return collateralAsset;
  return 'Unknown Market';
}

export function VaultRiskV2({ vaultAddress, preloadedData }: VaultRiskV2Props) {
  const { data: fetchedData, isLoading, error } = useVaultV2Risk(vaultAddress);
  const data = preloadedData ?? fetchedData;
  const isActuallyLoading = !preloadedData && isLoading;

  const totalAdapterAssets = data?.totalAdapterAssetsUsd ?? 0;

  const sortedAdapters = useMemo(() => {
    if (!data?.adapters) return [];
    return [...data.adapters].sort((a, b) => (b.allocationUsd ?? 0) - (a.allocationUsd ?? 0));
  }, [data?.adapters]);

  if (isActuallyLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Risk Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const isDeploymentProtection = error instanceof Error && 
      error.message.includes('Deployment protection');
    const apiUrl = `/api/vaults/v2/${vaultAddress}/risk`;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Risk Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load risk data: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          {isDeploymentProtection && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 p-3">
              <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                <strong>Preview Deployment Protection:</strong> This preview deployment requires authentication.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                To fix this, open the API route directly in your browser to authenticate:
              </p>
              <a
                href={apiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-900 dark:text-amber-100 underline hover:text-amber-700 dark:hover:text-amber-300 break-all"
              >
                {typeof window !== 'undefined' ? window.location.origin + apiUrl : apiUrl}
              </a>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                After authenticating, refresh this page. Production deployments don&apos;t require this step.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!data || sortedAdapters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Risk Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-slate-500 dark:text-slate-400">
            No adapter risk data found for this vault yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Risk Management
          </CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Weighted average across adapters, then underlying markets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className={cn('text-xl font-semibold', getScoreColor(data.vaultRiskScore))}>
            {data.vaultRiskScore.toFixed(2)}
          </p>
          <Badge
            variant="outline"
            className={cn('text-xs font-semibold px-2 py-1', getGradeColor(data.vaultRiskGrade))}
          >
            {data.vaultRiskGrade}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4 bg-slate-50/60 dark:bg-slate-900/50">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Allocated to Adapters</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {formatCompactUSD(totalAdapterAssets)}
            </p>
          </div>
          <div className="rounded-lg border p-4 bg-slate-50/60 dark:bg-slate-900/50">
            <p className="text-xs text-slate-500 dark:text-slate-400">Adapters Count</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {sortedAdapters.length}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {sortedAdapters.map((adapter) => {
            const adapterWeightPct =
              totalAdapterAssets > 0
                ? (adapter.allocationUsd / totalAdapterAssets) * 100
                : 0;
            const markets = [...adapter.markets].sort(
              (a, b) => (b.allocationUsd ?? 0) - (a.allocationUsd ?? 0)
            );
            const totalMarketAlloc = markets.reduce((sum, m) => sum + (m.allocationUsd ?? 0), 0);

            return (
              <div
                key={adapter.adapterAddress}
                className="rounded-lg border p-4 bg-white dark:bg-slate-950 shadow-sm space-y-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold">{adapter.adapterLabel}</p>
                      <Badge variant="outline" className="text-xs">
                        {adapter.adapterType === 'MetaMorphoAdapter' ? 'Vault Adapter' : 'Market Adapter'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Allocation: {formatCompactUSD(adapter.allocationUsd)} ·{' '}
                      {formatPercentage(adapterWeightPct, 2)} of vault
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={cn('text-lg font-semibold', getScoreColor(adapter.riskScore))}>
                      {adapter.riskScore.toFixed(2)}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn('text-xs font-semibold px-2 py-1', getGradeColor(adapter.riskGrade))}
                    >
                      {adapter.riskGrade}
                    </Badge>
                  </div>
                </div>

                {/* Markets inside adapter */}
                <div className="space-y-2">
                  {markets.map((m) => {
                    const allocPct =
                      totalMarketAlloc > 0
                        ? (m.allocationUsd / totalMarketAlloc) * 100
                        : 0;
                    const marketName = formatMarketIdentifier(
                      m.market.loanAsset?.symbol,
                      m.market.collateralAsset?.symbol
                    );
                    const idle = isMarketIdle(m.market);

                    const lltvPct = (() => {
                      if (m.market.lltv == null) return null;
                      const n = Number(m.market.lltv);
                      if (!Number.isFinite(n)) return null;
                      if (n > 1_000_000) {
                        // Values come scaled by 1e18 (e.g., 86e18 -> 86%)
                        return n / 1e18;
                      }
                      if (n <= 1) return n * 100;
                      return n; // already a percentage value
                    })();
                    const utilizationPct =
                      m.market.state?.utilization != null
                        ? m.market.state.utilization * 100
                        : null;
                    const supplyApyPct =
                      m.market.state?.supplyApy != null
                        ? m.market.state.supplyApy * 100
                        : null;
                    const borrowApyPct =
                      m.market.state?.borrowApy != null
                        ? m.market.state.borrowApy * 100
                        : null;
                    const liquidityUsd = m.market.state?.liquidityAssetsUsd ?? null;

                    return (
                      <div
                        key={m.market.uniqueKey || m.market.id}
                        className={cn(
                          'rounded-md border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
                          idle && 'bg-slate-50 dark:bg-slate-900'
                        )}
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{marketName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Allocation: {formatCompactUSD(m.allocationUsd)} · {formatPercentage(allocPct, 2)} of adapter
                          </p>
                        </div>
                        {!idle && m.scores && (
                          <div className="flex items-center gap-2">
                            <p className={cn('text-sm font-semibold', getScoreColor(m.scores.marketRiskScore))}>
                              {m.scores.marketRiskScore.toFixed(2)}
                            </p>
                            <Badge
                              variant="outline"
                              className={cn('text-xs font-semibold px-2 py-1', getGradeColor(m.scores.grade as MarketRiskGrade))}
                            >
                              {m.scores.grade}
                            </Badge>
                          </div>
                        )}
                        {idle && (
                          <Badge variant="outline" className="text-xs">
                            Idle
                          </Badge>
                        )}
                        {!idle && (
                          <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">LLTV</p>
                              <p className="font-medium">
                                {lltvPct != null ? formatPercentage(lltvPct, 2) : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Utilization</p>
                              <p className="font-medium">
                                {utilizationPct != null ? formatPercentage(utilizationPct, 2) : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Supply / Borrow APY</p>
                              <p className="font-medium">
                                {supplyApyPct != null ? formatPercentage(supplyApyPct, 2) : 'N/A'} /{' '}
                                {borrowApyPct != null ? formatPercentage(borrowApyPct, 2) : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Liquidity</p>
                              <p className="font-medium">
                                {liquidityUsd != null ? formatCompactUSD(liquidityUsd) : 'N/A'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

