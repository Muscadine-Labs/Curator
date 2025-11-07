'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import { useMorphoMarkets } from '@/lib/hooks/useMorphoMarkets';
import type { MorphoMarketMetrics } from '@/lib/morpho/types';
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
import { RatingBadge } from '@/components/morpho/RatingBadge';
import { formatCompactUSD, formatPercentage } from '@/lib/format/number';

export default function MorphoMarketsPage() {
  const { data, isLoading, error } = useMorphoMarkets();
  const markets = useMemo(() => data?.markets ?? [], [data?.markets]);

  const { grouped, totals } = useMemo(() => {
    const initial = {
      grouped: new Map<string, MorphoMarketMetrics[]>(),
      totals: { markets: markets.length, avgRating: 0 },
    };

    if (!markets.length) {
      return {
        grouped: initial.grouped,
        totals: { markets: 0, avgRating: 0 },
      };
    }

    const map = new Map<string, MorphoMarketMetrics[]>();
    let ratingSum = 0;

    markets.forEach((market) => {
      const symbol = market.symbol?.toUpperCase() ?? 'UNKNOWN';
      const key =
        symbol === 'USDC'
          ? 'USDC'
          : symbol === 'WETH'
          ? 'WETH'
          : symbol === 'CBBTC'
          ? 'cbBTC'
          : 'Other';

      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(market);
      ratingSum += market.rating;
    });

    const avgRating = ratingSum / markets.length;

    return {
      grouped: map,
      totals: { markets: markets.length, avgRating },
    };
  }, [markets]);

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
                <h1 className="text-3xl font-bold">Morpho Markets</h1>
                <p className="text-muted-foreground mt-1">
                  Curated risk scoring across live Morpho markets
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
              <Button variant="outline" asChild>
                <Link
                  href="https://www.steakhouse.financial/docs/risk-management"
                  target="_blank"
                  rel="noreferrer"
                  className="gap-2"
                >
                  Steakhouse Risk Playbook
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Curator Risk Rating</CardTitle>
              <CardDescription>
                0–100 blended score combining utilization, rate alignment, stress
                exposure, withdrawal liquidity, and liquidation depth.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Inspired by Gauntlet’s vault curation diagnostics and Steakhouse’s
                collateral risk playbook, this score monitors upstream credit risk,
                downstream liquidity, and automated guardrails.
              </p>
              <p className="text-xs">
                Weights and stress parameters are configurable in the backend and
                default to Gauntlet tail-event drawdowns (30% price / 40% liquidity)
                with a Prime bias toward liquid collateral.
              </p>
              <Badge variant="outline" className="font-medium">
                Avg rating: {isLoading ? '—' : totals.avgRating.toFixed(1)}
              </Badge>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>At a Glance</CardTitle>
              <CardDescription>
                Snapshot of current coverage and how markets compare.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <OverviewStat
                label="Tracked Markets"
                value={isLoading ? '—' : totals.markets.toString()}
              />
              <OverviewStat
                label="Top Rating"
                value={
                  isLoading || !markets.length
                    ? '—'
                    : Math.max(...markets.map((m) => m.rating)).toFixed(0)
                }
              />
              <OverviewStat
                label="Lowest Rating"
                value={
                  isLoading || !markets.length
                    ? '—'
                    : Math.min(...markets.map((m) => m.rating)).toFixed(0)
                }
              />
            </CardContent>
          </Card>
        </section>

        {error ? (
          <Card className="border-destructive/40 bg-destructive/5 text-destructive">
            <CardHeader>
              <CardTitle>Error Loading Markets</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{error.message}</p>
            </CardContent>
          </Card>
        ) : null}

        {isLoading ? (
          <LoadingState />
        ) : (
          <MarketsGroups grouped={grouped} />
        )}
      </main>
    </div>
  );
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/50 bg-muted/40 px-4 py-3">
      <div className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-6">
      {[...Array(3)].map((_, idx) => (
        <Card key={idx}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...Array(4)].map((__, rowIdx) => (
                <Skeleton key={rowIdx} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type GroupedMarkets = Map<string, MorphoMarketMetrics[]>;

function MarketsGroups({ grouped }: { grouped: GroupedMarkets }) {
  const categories = ['USDC', 'WETH', 'cbBTC', 'Other'];

  return (
    <div className="space-y-8">
      {categories
        .filter((category) => (grouped.get(category) ?? []).length > 0)
        .map((category) => {
          const items = grouped.get(category) ?? [];
          return (
            <Card key={category} className="overflow-hidden">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>{category} Markets</CardTitle>
                  <CardDescription>
                    {category === 'Other'
                      ? 'Long-tail assets that pass configurability thresholds.'
                      : `Markets collateralized by ${category}.`}
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  {items.length} {items.length === 1 ? 'market' : 'markets'}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs uppercase tracking-wide text-muted-foreground">
                        <TableHead className="min-w-[200px]">Market</TableHead>
                        <TableHead className="min-w-[140px]">Curator Rating</TableHead>
                        <TableHead className="min-w-[120px]">Utilization</TableHead>
                        <TableHead className="min-w-[140px]">Supply Rate</TableHead>
                        <TableHead className="min-w-[140px]">Borrow Rate</TableHead>
                        <TableHead className="min-w-[160px]">Liquidity Buffer</TableHead>
                        <TableHead className="min-w-[140px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((market) => (
                        <TableRow key={market.id} className="hover:bg-muted/40">
                          <TableCell className="font-mono text-xs">
                            {market.id}
                          </TableCell>
                          <TableCell>
                            <RatingBadge rating={market.rating} />
                          </TableCell>
                          <TableCell>
                            {formatPercentage(market.utilization * 100, 2)}
                          </TableCell>
                          <TableCell>
                            {formatPercentage((market.supplyRate ?? 0) * 100, 2)}
                          </TableCell>
                          <TableCell>
                            {formatPercentage((market.borrowRate ?? 0) * 100, 2)}
                          </TableCell>
                          <TableCell>
                            {formatCompactUSD(market.availableLiquidity)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/markets/${market.id}`}>
                                View details
                                <ExternalLink className="ml-1 h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}

