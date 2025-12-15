'use client';

import { useVaultV1MarketRisk } from '@/lib/hooks/useVaultV1MarketRisk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCompactUSD } from '@/lib/format/number';
import type { MarketRiskGrade } from '@/lib/morpho/compute-v1-market-risk';
import { isMarketIdle } from '@/lib/morpho/compute-v1-market-risk';

interface MarketRiskV1Props {
  vaultAddress: string;
}

/**
 * Get color classes for a letter grade
 */
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

/**
 * Get color classes for a component score (0-5)
 */
function getScoreColor(score: number): string {
  if (score >= 4) {
    return 'text-emerald-600 dark:text-emerald-400';
  }
  if (score >= 3) {
    return 'text-sky-600 dark:text-sky-400';
  }
  if (score >= 2) {
    return 'text-amber-600 dark:text-amber-400';
  }
  if (score >= 1) {
    return 'text-orange-600 dark:text-orange-400';
  }
  return 'text-rose-600 dark:text-rose-400';
}

/**
 * Format market identifier
 */
function formatMarketIdentifier(
  loanAsset: string | undefined,
  collateralAsset: string | undefined
): string {
  if (loanAsset && collateralAsset) {
    return `${collateralAsset}/${loanAsset}`;
  }
  if (loanAsset) {
    return loanAsset;
  }
  if (collateralAsset) {
    return collateralAsset;
  }
  return 'Unknown Market';
}

export function MarketRiskV1({ vaultAddress }: MarketRiskV1Props) {
  const { data, isLoading, error } = useVaultV1MarketRisk(vaultAddress);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Risk</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Risk</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load market risk data: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.markets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Risk</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-slate-500 dark:text-slate-400">
            No markets found for this vault
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort markets by vault allocation (most allocated first)
  const sortedMarkets = [...data.markets].sort((a, b) => {
    const aSupply = a.market.vaultSupplyAssetsUsd ?? 0;
    const bSupply = b.market.vaultSupplyAssetsUsd ?? 0;
    return bSupply - aSupply; // Descending order (most to least)
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Risk</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {sortedMarkets.map(({ market, scores }) => {
          const marketName = formatMarketIdentifier(
            market.loanAsset?.symbol,
            market.collateralAsset?.symbol
          );
          
          // LTV is stored as a fraction scaled by 1e18 in Morpho (e.g., "860000000000000000" = 0.86 = 86%)
          // Convert wei to percentage for display: divide by 1e16 (1e18 / 100)
          const lltvPercent = market.lltv 
            ? (Number(market.lltv) / 1e16).toFixed(2)
            : 'N/A';

          const isIdle = isMarketIdle(market);
          const vaultSupplyUsd = market.vaultSupplyAssetsUsd ?? 0;
          const vaultTotalUsd = market.vaultTotalAssetsUsd ?? 0;
          const marketTotalSupplyUsd = market.marketTotalSupplyUsd ?? 0;

          // Calculate percentages
          const vaultAllocationPercent = vaultTotalUsd > 0 
            ? (vaultSupplyUsd / vaultTotalUsd) * 100 
            : 0;
          const marketSharePercent = marketTotalSupplyUsd > 0
            ? (vaultSupplyUsd / marketTotalSupplyUsd) * 100
            : 0;

          return (
            <div
              key={market.uniqueKey || market.id}
              className={cn(
                "border rounded-lg p-4 space-y-4",
                isIdle 
                  ? "bg-slate-100/50 dark:bg-slate-800/50 opacity-75" 
                  : "bg-slate-50/50 dark:bg-slate-900/50"
              )}
            >
              {/* Market Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{marketName}</h3>
                    {isIdle && (
                      <Badge variant="outline" className="text-xs">
                        Idle
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      LTV: {lltvPercent}%
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Vault Supply: {formatCompactUSD(vaultSupplyUsd)}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {(vaultAllocationPercent / 100).toFixed(2)}% of vault · {(marketSharePercent / 100).toFixed(2)}% of market
                    </p>
                  </div>
                </div>
                {!isIdle && scores && (
                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className={cn(
                        'px-3 py-1.5 text-sm font-semibold',
                        getGradeColor(scores.grade as MarketRiskGrade)
                      )}
                    >
                      {scores.grade} · {scores.marketRiskScore.toFixed(2)}
                    </Badge>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Total Risk Score
                    </p>
                  </div>
                )}
              </div>

              {/* Component Scores - Only show if not idle */}
              {!isIdle && scores && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                      Oracle
                    </p>
                    <p className={cn('text-lg font-semibold', getScoreColor(scores.oracleScore))}>
                      {scores.oracleScore.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                      LTV
                    </p>
                    <p className={cn('text-lg font-semibold', getScoreColor(scores.ltvScore))}>
                      {scores.ltvScore.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                      Liquidity
                    </p>
                    <p className={cn('text-lg font-semibold', getScoreColor(scores.liquidityScore))}>
                      {scores.liquidityScore.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                      Liquidation
                    </p>
                    <p className={cn('text-lg font-semibold', getScoreColor(scores.liquidationScore))}>
                      {scores.liquidationScore.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
