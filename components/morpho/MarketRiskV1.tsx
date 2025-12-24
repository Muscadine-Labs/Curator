'use client';

import { useVaultV1MarketRisk } from '@/lib/hooks/useVaultV1MarketRisk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCompactUSD, formatPercentage } from '@/lib/format/number';
import { formatAddress } from '@/lib/format/number';
import type { MarketRiskGrade } from '@/lib/morpho/compute-v1-market-risk';
import { isMarketIdle } from '@/lib/morpho/compute-v1-market-risk';
import { Info } from 'lucide-react';

interface MarketRiskV1Props {
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

export function MarketRiskV1({ vaultAddress, preloadedData }: MarketRiskV1Props) {
  const { data: fetchedData, isLoading, error } = useVaultV1MarketRisk(vaultAddress);
  const data = preloadedData ?? fetchedData;

  if (!preloadedData && isLoading) {
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
  // If vault supply is the same, idle markets go last
  const sortedMarkets = [...data.markets].sort((a, b) => {
    const aSupply = a.market.vaultSupplyAssetsUsd ?? 0;
    const bSupply = b.market.vaultSupplyAssetsUsd ?? 0;
    
    // First, sort by vault supply (descending)
    if (aSupply !== bSupply) {
      return bSupply - aSupply;
    }
    
    // If vault supply is the same, put idle markets last
    const aIsIdle = isMarketIdle(a.market);
    const bIsIdle = isMarketIdle(b.market);
    
    if (aIsIdle && !bIsIdle) {
      return 1; // a goes after b
    }
    if (!aIsIdle && bIsIdle) {
      return -1; // a goes before b
    }
    
    // Both idle or both not idle - maintain current order
    return 0;
  }).map(item => ({
    market: item.market,
    scores: item.scores,
    oracleTimestampData: item.oracleTimestampData,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Risk</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {sortedMarkets.map(({ market, scores, oracleTimestampData }) => {
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

          // Calculate underlying metrics for display
          const state = market.state;
          const lltvRaw = market.lltv;
          const lltvRatio = lltvRaw ? Number(lltvRaw) / 1e18 : 0;
          
          // Check if loan and collateral are same/derivative assets (use 2.5% shock instead of 5%)
          const loanAsset = market.loanAsset;
          const collateralAsset = market.collateralAsset;
          const loanSymbol = loanAsset?.symbol?.toUpperCase() || '';
          const collateralSymbol = collateralAsset?.symbol?.toUpperCase() || '';
          
          const isSameAsset = loanAsset && collateralAsset && (
            loanAsset.address.toLowerCase() === collateralAsset.address.toLowerCase() ||
            loanSymbol === collateralSymbol ||
            (['WSTETH', 'STETH', 'RETH', 'CBETH', 'WETH', 'ETH'].includes(loanSymbol) &&
             ['WSTETH', 'STETH', 'RETH', 'CBETH', 'WETH', 'ETH'].includes(collateralSymbol)) ||
            (['CBBTC', 'LBTC', 'WBTC', 'BTC'].includes(loanSymbol) &&
             ['CBBTC', 'LBTC', 'WBTC', 'BTC'].includes(collateralSymbol)) ||
            ((loanSymbol === 'USDC' || loanSymbol === 'USDC.E') &&
             (collateralSymbol === 'USDC' || collateralSymbol === 'USDC.E')) ||
            ((loanSymbol === 'USDT' || loanSymbol === 'USDT.E') &&
             (collateralSymbol === 'USDT' || collateralSymbol === 'USDT.E'))
          );
          const priceShock = isSameAsset ? 0.025 : 0.05; // 2.5% or 5%
          const shockMultiplier = 1 - priceShock; // 0.975 or 0.95
          
          // Liquidation Headroom calculation
          const collateralUsd = state?.collateralAssetsUsd ? Number(state.collateralAssetsUsd) : 0;
          const borrowUsd = state?.borrowAssetsUsd ? Number(state.borrowAssetsUsd) : 0;
          const supplyUsd = state?.supplyAssetsUsd ? Number(state.supplyAssetsUsd) : 0;
          const headroom = borrowUsd > 0 && collateralUsd > 0 
            ? collateralUsd * shockMultiplier * lltvRatio - borrowUsd 
            : null;
          const headroomRatio = headroom !== null && borrowUsd > 0 
            ? (headroom / borrowUsd) * 100 
            : null;

          // Utilization calculation
          const utilization = state?.utilization !== null && state?.utilization !== undefined
            ? state.utilization * 100
            : (supplyUsd > 0 ? (borrowUsd / supplyUsd) * 100 : null);

          // Coverage Ratio calculation
          const availableLiquidityUsd = supplyUsd - borrowUsd;
          const liquidatableBorrow = borrowUsd > 0 && collateralUsd > 0
            ? Math.max(0, borrowUsd - collateralUsd * shockMultiplier * lltvRatio)
            : null;
          const coverage = liquidatableBorrow !== null && liquidatableBorrow > 0 && availableLiquidityUsd > 0
            ? availableLiquidityUsd / liquidatableBorrow
            : null;

          // Oracle freshness calculation
          const oracleAgeHours = oracleTimestampData?.ageSeconds 
            ? oracleTimestampData.ageSeconds / 3600 
            : null;
          const oracleAgeDays = oracleAgeHours !== null 
            ? oracleAgeHours / 24 
            : null;

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
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {market.uniqueKey ? (
                      <a
                        href={`https://app.morpho.org/base/market/${market.uniqueKey}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-lg hover:text-blue-600 dark:hover:text-blue-400 transition-colors underline decoration-1 underline-offset-2"
                      >
                        {marketName}
                      </a>
                    ) : (
                      <h3 className="font-semibold text-lg">{marketName}</h3>
                    )}
                    <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      LTV: {lltvPercent}%
                    </span>
                    {isIdle && (
                      <Badge variant="outline" className="text-xs">
                        Idle
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
                      Vault Supply: {formatCompactUSD(vaultSupplyUsd)} · {vaultAllocationPercent.toFixed(2)}% of vault · {marketSharePercent.toFixed(2)}% of market
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

              {/* Bad Debt Disclaimer - Show if market has bad debt greater than $1.00 */}
              {!isIdle && scores && scores.realizedBadDebt != null && scores.realizedBadDebt > 1.0 && (
                <div className="rounded-lg border-2 border-red-500/50 bg-red-50 dark:bg-red-950/20 p-3">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
                    ⚠️ Bad Debt Warning
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-300">
                    This market has {formatCompactUSD(scores.realizedBadDebt)} of bad debt. Grade automatically set to F.
                  </p>
                </div>
              )}

              {/* Component Scores - Only show if not idle */}
              {!isIdle && scores && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Liquidation Headroom
                        </p>
                        <div className="group relative">
                          <Info 
                            className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 cursor-help hover:text-slate-600 dark:hover:text-slate-300 transition-colors" 
                            aria-label="Information"
                          />
                          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-64 p-2 text-xs text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 pointer-events-none">
                            Measures the buffer before liquidation under a price shock. Uses -2.5% shock for same/derivative assets (e.g., USDC/USDC, wstETH/ETH) and -5% for different assets. Higher headroom (positive value) indicates more safety margin. Negative headroom means the position would be underwater.
                            <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-200 dark:border-t-slate-700"></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={cn('text-lg font-semibold', getScoreColor(scores.liquidationHeadroomScore))}>
                          {scores.liquidationHeadroomScore.toFixed(2)}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs font-semibold px-1.5 py-0.5',
                            getGradeColor(getComponentGrade(scores.liquidationHeadroomScore))
                          )}
                        >
                          {getComponentGrade(scores.liquidationHeadroomScore)}
                        </Badge>
                      </div>
                      {headroomRatio !== null && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {headroomRatio >= 0 
                            ? `Headroom: ${headroomRatio.toFixed(2)}% (${formatCompactUSD(headroom ?? 0)}) @ ${(priceShock * 100).toFixed(1)}% shock`
                            : `Underwater: ${Math.abs(headroomRatio).toFixed(2)}% (${formatCompactUSD(headroom ?? 0)}) @ ${(priceShock * 100).toFixed(1)}% shock`}
                        </p>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Utilization
                        </p>
                        <div className="group relative">
                          <Info 
                            className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 cursor-help hover:text-slate-600 dark:hover:text-slate-300 transition-colors" 
                            aria-label="Information"
                          />
                          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-64 p-2 text-xs text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 pointer-events-none">
                            The ratio of borrowed assets to supplied assets. Scored relative to the IRM&apos;s target utilization (kink). Utilization below target is safer, while exceeding target increases risk.
                            <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-200 dark:border-t-slate-700"></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={cn('text-lg font-semibold', getScoreColor(scores.utilizationScore))}>
                          {scores.utilizationScore.toFixed(2)}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs font-semibold px-1.5 py-0.5',
                            getGradeColor(getComponentGrade(scores.utilizationScore))
                          )}
                        >
                          {getComponentGrade(scores.utilizationScore)}
                        </Badge>
                      </div>
                      {utilization !== null && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Utilization: {utilization.toFixed(2)}%
                        </p>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Coverage Ratio
                        </p>
                        <div className="group relative">
                          <Info 
                            className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 cursor-help hover:text-slate-600 dark:hover:text-slate-300 transition-colors" 
                            aria-label="Information"
                          />
                          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-64 p-2 text-xs text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 pointer-events-none">
                            The ratio of available liquidity to liquidatable borrows under a price shock. Uses -2.5% shock for same/derivative assets and -5% for different assets. A ratio ≥1.0 means the market can fully cover all liquidations. Lower ratios indicate insufficient liquidity.
                            <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-200 dark:border-t-slate-700"></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={cn('text-lg font-semibold', getScoreColor(scores.coverageRatioScore))}>
                          {scores.coverageRatioScore.toFixed(2)}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs font-semibold px-1.5 py-0.5',
                            getGradeColor(getComponentGrade(scores.coverageRatioScore))
                          )}
                        >
                          {getComponentGrade(scores.coverageRatioScore)}
                        </Badge>
                      </div>
                      {coverage !== null && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Coverage: {coverage.toFixed(2)}x @ {(priceShock * 100).toFixed(1)}% shock
                          {liquidatableBorrow !== null && (
                            <span className="ml-1">
                              ({formatCompactUSD(availableLiquidityUsd)} / {formatCompactUSD(liquidatableBorrow)})
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Oracle Freshness
                        </p>
                        <div className="group relative">
                          <Info 
                            className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 cursor-help hover:text-slate-600 dark:hover:text-slate-300 transition-colors" 
                            aria-label="Information"
                          />
                          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-64 p-2 text-xs text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 pointer-events-none">
                            Measures how recently the price oracle was updated. Fresh oracles (&lt;1 hour) are most reliable. Stale oracles (&gt;24 hours) increase risk as prices may be outdated. Opaque oracles (no address) receive the lowest score.
                            <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-200 dark:border-t-slate-700"></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={cn('text-lg font-semibold', getScoreColor(scores.oracleScore))}>
                          {scores.oracleScore.toFixed(2)}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs font-semibold px-1.5 py-0.5',
                            getGradeColor(getComponentGrade(scores.oracleScore))
                          )}
                        >
                          {getComponentGrade(scores.oracleScore)}
                        </Badge>
                      </div>
                      {oracleTimestampData?.updatedAt && (() => {
                        const date = new Date(oracleTimestampData.updatedAt * 1000);
                        // Format as UTC: "DD MMM YYYY, HH:MM:SS UTC"
                        const year = date.getUTCFullYear();
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const month = monthNames[date.getUTCMonth()];
                        const day = String(date.getUTCDate()).padStart(2, '0');
                        const hours = String(date.getUTCHours()).padStart(2, '0');
                        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
                        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
                        const formatted = `${day} ${month} ${year}, ${hours}:${minutes}:${seconds} UTC`;
                        
                        // Format age
                        let ageText = '';
                        if (oracleAgeDays !== null) {
                          if (oracleAgeDays < 1) {
                            ageText = `${oracleAgeHours?.toFixed(1) ?? 0}h ago`;
                          } else if (oracleAgeDays < 7) {
                            ageText = `${oracleAgeDays.toFixed(1)}d ago`;
                          } else {
                            ageText = `${oracleAgeDays.toFixed(0)}d ago`;
                          }
                        }
                        
                        return (
                          <div className="mt-1 space-y-0.5">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Last update: {formatted}
                            </p>
                            {ageText && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Age: {ageText}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                      {!oracleTimestampData?.updatedAt && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-words">
                          Oracle: {market.oracleAddress ? formatAddress(market.oracleAddress) : 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Market Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                        Total Market Size
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCompactUSD(marketTotalSupplyUsd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                        Total Liquidity
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCompactUSD(market.state?.liquidityAssetsUsd ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                        Supply APR
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {market.state?.supplyApy !== null && market.state?.supplyApy !== undefined
                          ? formatPercentage(market.state.supplyApy * 100, 2)
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                        Borrow APR
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {market.state?.borrowApy !== null && market.state?.borrowApy !== undefined
                          ? formatPercentage(market.state.borrowApy * 100, 2)
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
