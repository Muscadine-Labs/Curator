'use client';

import { useVaultV1MarketRisk } from '@/lib/hooks/useVaultV1MarketRisk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCompactUSD, formatPercentage } from '@/lib/format/number';
import type { MarketRiskGrade } from '@/lib/morpho/compute-v1-market-risk';
import { isMarketIdle } from '@/lib/morpho/compute-v1-market-risk';

interface VaultRiskV1Props {
  vaultAddress: string;
  preloadedData?: import('@/app/api/vaults/v1/[id]/market-risk/route').V1VaultMarketRiskResponse | null;
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
 * Get color classes for a component score (0-100)
 */
function getScoreColor(score: number): string {
  if (score >= 80) {
    return 'text-emerald-600 dark:text-emerald-400';
  }
  if (score >= 60) {
    return 'text-sky-600 dark:text-sky-400';
  }
  if (score >= 40) {
    return 'text-amber-600 dark:text-amber-400';
  }
  if (score >= 20) {
    return 'text-orange-600 dark:text-orange-400';
  }
  return 'text-rose-600 dark:text-rose-400';
}

/**
 * Convert a component score (0-100) to a letter grade
 */
function getComponentGrade(score: number): MarketRiskGrade {
  if (score >= 93) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 87) return 'A−';
  if (score >= 84) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 77) return 'B−';
  if (score >= 74) return 'C+';
  if (score >= 70) return 'C';
  if (score >= 65) return 'C−';
  if (score >= 60) return 'D';
  return 'F';
}

export function VaultRiskV1({ vaultAddress, preloadedData }: VaultRiskV1Props) {
  const { data: fetchedData, isLoading, error } = useVaultV1MarketRisk(vaultAddress);
  const data = preloadedData ?? fetchedData;

  if (!preloadedData && isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vault Risk</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vault Risk</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load vault risk data: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.markets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vault Risk</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-slate-500 dark:text-slate-400">
            No markets found for this vault
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate vault-level metrics
  const vaultTvl = data.markets[0]?.market.vaultTotalAssetsUsd ?? 0;
  
  // Use vault liquidity from GraphQL
  const vaultLiquidity = data.vaultLiquidity ?? 0;

  // Calculate weighted risk score
  let totalVaultSupply = 0;
  let weightedRiskScoreSum = 0;

  data.markets.forEach((item) => {
    const vaultSupplyUsd = item.market.vaultSupplyAssetsUsd ?? 0;
    totalVaultSupply += vaultSupplyUsd;

    // Only include non-idle markets with scores in the weighted calculation
    if (!isMarketIdle(item.market) && item.scores && vaultSupplyUsd > 0) {
      weightedRiskScoreSum += item.scores.marketRiskScore * vaultSupplyUsd;
    }
  });

  // Calculate weighted average risk score
  // Weight by total vault supply to get proper weighting
  const vaultRiskScore = totalVaultSupply > 0 
    ? weightedRiskScoreSum / totalVaultSupply 
    : 0;

  const vaultRiskGrade = getComponentGrade(vaultRiskScore);
  const liquidityVsTvlPercent = vaultTvl > 0 
    ? (vaultLiquidity / vaultTvl) * 100 
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vault Risk</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Liquidity Available vs TVL */}
          <div className="border rounded-lg p-4 bg-slate-50/50 dark:bg-slate-900/50">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Vault Liquidity Available
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatCompactUSD(vaultLiquidity)}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {formatPercentage(liquidityVsTvlPercent, 2)}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>TVL: {formatCompactUSD(vaultTvl)}</span>
              </div>
            </div>
          </div>

          {/* Vault Risk Score */}
          <div className="border rounded-lg p-4 bg-slate-50/50 dark:bg-slate-900/50">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Vault Risk Score
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className={cn('text-lg font-semibold', getScoreColor(vaultRiskScore))}>
                  {vaultRiskScore.toFixed(2)}
                </p>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs font-semibold px-2 py-1',
                    getGradeColor(vaultRiskGrade)
                  )}
                >
                  {vaultRiskGrade}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Weighted average of market risk scores by vault allocation
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

