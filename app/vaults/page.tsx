'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import { useMorphoMarkets } from '@/lib/hooks/useMorphoMarkets';
import { useMarketsSupplied } from '@/lib/hooks/useMarkets';
import { WalletConnect } from '@/components/WalletConnect';
import type { MorphoMarketMetrics } from '@/lib/morpho/types';
import type { SuppliedMarket } from '@/lib/hooks/useMarkets';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RatingBadge } from '@/components/morpho/RatingBadge';
import { formatCompactUSD, formatPercentage } from '@/lib/format/number';
import { vaults } from '@/lib/config/vaults';

type MergedMarket = SuppliedMarket & {
  rating?: number;
  morphoMetrics?: MorphoMarketMetrics;
};

export default function VaultsPage() {
  const morpho = useMorphoMarkets();
  const supplied = useMarketsSupplied();

  const isLoading = morpho.isLoading || supplied.isLoading;
  const error = morpho.error || supplied.error;

  const mergedMarkets = useMemo(() => {
    if (!supplied.data?.markets || !morpho.data?.markets) return [];

    // Create map using both id and uniqueKey for matching
    const morphoById = new Map<string, MorphoMarketMetrics>();
    morpho.data.markets.forEach((m) => {
      morphoById.set(m.id, m);
      // Also add by uniqueKey if available in raw data
      if (m.raw?.uniqueKey) {
        morphoById.set(m.raw.uniqueKey, m);
      }
    });

    return supplied.data.markets.map((market) => {
      const morphoData = morphoById.get(market.uniqueKey);
      return {
        ...market,
        rating: morphoData?.rating,
        morphoMetrics: morphoData,
      } as MergedMarket;
    });
  }, [supplied.data?.markets, morpho.data?.markets]);

  const vaultSummaries = useMemo(() => {
    if (!supplied.data?.vaultAllocations) return [];

    return vaults.map((vault) => {
      const allocation = supplied.data.vaultAllocations.find(
        (va) => va.address.toLowerCase() === vault.address.toLowerCase()
      );

      const totalSupplied = allocation?.allocations.reduce(
        (sum, a) => sum + a.supplyAssetsUsd,
        0
      ) ?? 0;

      const vaultMarkets = mergedMarkets.filter((m) =>
        allocation?.allocations.some((a) => a.marketKey === m.uniqueKey)
      );

      const avgUtilization =
        vaultMarkets.length > 0
          ? vaultMarkets.reduce((sum, m) => sum + (m.state?.utilization ?? 0), 0) / vaultMarkets.length
          : 0;

      const totalRewardApr = vaultMarkets.reduce((sum, m) => {
        const rewards = m.state?.rewards ?? [];
        const rewardApr = rewards.reduce((s, r) => s + (r.supplyApr ?? 0), 0);
        return sum + rewardApr;
      }, 0);

      const avgRating =
        vaultMarkets.filter((m) => m.rating).length > 0
          ? vaultMarkets.filter((m) => m.rating).reduce((sum, m) => sum + (m.rating ?? 0), 0) /
            vaultMarkets.filter((m) => m.rating).length
          : null;

      return {
        vault,
        totalSupplied,
        avgUtilization,
        totalRewardApr,
        avgRating,
        markets: vaultMarkets,
      };
    });
  }, [supplied.data, mergedMarkets]);


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Vaults Overview</h1>
                <p className="text-muted-foreground mt-1">
                  Vault allocations with curator risk ratings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/markets">All Markets</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/fees">Fee Splitter</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link
                  href="https://vaultbook.gauntlet.xyz/vaults/morpho-vaults/vault-curation-considerations-a-deeper-dive"
                  target="_blank"
                  rel="noreferrer"
                  className="gap-2"
                >
                  Gauntlet VaultBook
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
              <WalletConnect />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error Loading Data</AlertTitle>
            <AlertDescription>
              {morpho.error?.message || supplied.error?.message || 'Failed to load market data'}
            </AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <LoadingState />
        ) : (
          <>
            {/* Each Vault followed by its Markets Table */}
            <div className="space-y-12">
              {vaultSummaries.map((vaultSummary) => {
                const borderColor = 
                  vaultSummary.vault.asset === 'USDC' ? 'border-emerald-500/20' :
                  vaultSummary.vault.asset === 'cbBTC' ? 'border-orange-500/20' :
                  'border-blue-500/20';
                
                return (
                  <div key={vaultSummary.vault.id} className="space-y-6">
                    {/* Vault Summary Card */}
                    <Link href={`/vaults/${vaultSummary.vault.address}`}>
                      <Card className={`${borderColor} cursor-pointer hover:shadow-lg transition-all duration-200`}>
                        <CardHeader>
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-3">
                                <CardTitle className="text-2xl">{vaultSummary.vault.name}</CardTitle>
                                <Badge variant="outline">{vaultSummary.vault.asset}</Badge>
                              </div>
                              <CardDescription className="mt-2">
                                {vaultSummary.vault.description}
                              </CardDescription>
                            </div>
                            {vaultSummary.avgRating && (
                              <RatingBadge rating={vaultSummary.avgRating} className="text-sm px-3 py-1.5" />
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                              label="Total Supplied"
                              value={formatCompactUSD(vaultSummary.totalSupplied)}
                            />
                            <StatCard
                              label="Avg Utilization"
                              value={formatPercentage(vaultSummary.avgUtilization * 100, 2)}
                            />
                            <StatCard
                              label="Reward APR"
                              value={formatPercentage(vaultSummary.totalRewardApr, 2)}
                              className="text-green-600 dark:text-green-400"
                            />
                            <StatCard
                              label="Markets"
                              value={vaultSummary.markets.length.toString()}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>

                    {/* Markets Table for this Vault */}
                    <Card>
                      <CardHeader>
                        <CardTitle>{vaultSummary.vault.asset} Vault Markets</CardTitle>
                        <CardDescription>
                          Markets where the {vaultSummary.vault.name} is actively supplying capital
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        {vaultSummary.markets.length > 0 ? (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="text-xs uppercase tracking-wide">
                                  <TableHead className="min-w-[180px]">Market Pair</TableHead>
                                  <TableHead className="min-w-[100px]">LLTV</TableHead>
                                  <TableHead className="min-w-[120px]">Supplied USD</TableHead>
                                  <TableHead className="min-w-[110px]">Utilization</TableHead>
                                  <TableHead className="min-w-[110px]">Reward APR</TableHead>
                                  <TableHead className="min-w-[140px]">Curator Rating</TableHead>
                                  <TableHead className="min-w-[200px]">Borrowing</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {vaultSummary.markets.map((market) => {
                                  // Use supplyApy from market state (already in percentage form from Morpho)
                                  const supplyApy = (market.state?.supplyApy ?? 0) * 100;

                                  return (
                                    <TableRow 
                                      key={market.uniqueKey} 
                                      className="hover:bg-muted/40 cursor-pointer"
                                      onClick={() => window.location.href = `/markets/${market.uniqueKey}`}
                                    >
                                      <TableCell className="font-medium">
                                        <Link 
                                          href={`/markets/${market.uniqueKey}`}
                                          className="flex items-center gap-2 hover:underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <span>{market.collateralAsset?.symbol}</span>
                                          <span className="text-muted-foreground">/</span>
                                          <span>{market.loanAsset?.symbol}</span>
                                        </Link>
                                      </TableCell>
                                      <TableCell>
                                        {market.lltv ? formatPercentage(market.lltv * 100, 0) : '—'}
                                      </TableCell>
                                      <TableCell>
                                        {formatCompactUSD(market.state?.supplyAssetsUsd ?? 0)}
                                      </TableCell>
                                      <TableCell>
                                        {formatPercentage((market.state?.utilization ?? 0) * 100, 2)}
                                      </TableCell>
                                      <TableCell className="text-green-600 dark:text-green-400">
                                        {supplyApy > 0 ? formatPercentage(supplyApy, 2) : '—'}
                                      </TableCell>
                                      <TableCell>
                                        {market.rating ? (
                                          <RatingBadge rating={market.rating} />
                                        ) : (
                                          <span className="text-xs text-muted-foreground">N/A</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {market.collateralAsset?.symbol} → {market.loanAsset?.symbol} borrow
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="p-8 text-center text-muted-foreground">
                            No active markets for this vault
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>

            {/* Ratings Digest */}
            <Card>
            <CardHeader>
                <CardTitle>Ratings Digest</CardTitle>
                <CardDescription>
                  Quick overview of all market ratings
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mergedMarkets
                    .filter((m) => m.rating)
                    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
                    .map((market) => (
                      <div
                        key={market.uniqueKey}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {market.collateralAsset?.symbol} / {market.loanAsset?.symbol}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {market.collateralAsset?.symbol} / {market.loanAsset?.symbol}
            </div>
          </div>
                        {market.rating && <RatingBadge rating={market.rating} className="ml-2" />}
                      </div>
                    ))}
                </div>
            </CardContent>
          </Card>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border/50 bg-muted/40 px-4 py-3">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${className ?? 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-6">
      {[...Array(4)].map((_, idx) => (
        <Card key={idx}>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(3)].map((__, rowIdx) => (
                <Skeleton key={rowIdx} className="h-12 w-full" />
              ))}
        </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
