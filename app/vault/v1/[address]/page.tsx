'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Shield, Wallet } from 'lucide-react';
import { useVault } from '@/lib/hooks/useProtocolStats';
import { useMorphoMarkets } from '@/lib/hooks/useMorphoMarkets';
import { AppShell } from '@/components/layout/AppShell';
import { KpiCard } from '@/components/KpiCard';
import { RoleList } from '@/components/RoleList';
import { AllocatorList } from '@/components/AllocatorList';
import { AddressBadge } from '@/components/AddressBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RatingBadge } from '@/components/morpho/RatingBadge';
import { formatCompactUSD, formatPercentage } from '@/lib/format/number';
import type { MorphoMarketMetrics } from '@/lib/morpho/types';
import { getVaultByAddress } from '@/lib/config/vaults';
import { useVaultRisk } from '@/lib/hooks/useVaultRisk';

export default function VaultDetailPage() {
  const params = useParams();
  const vaultAddress = params.address as string;
  const { data: vault, isLoading } = useVault(vaultAddress);
  const { data: morpho } = useMorphoMarkets();
  const { summary: riskSummary, isLoading: riskLoading } = useVaultRisk(vault);

  const vaultMarkets = useMemo(() => {
    if (!vault?.allocation) return [];

    const metricsByUniqueKey = new Map<string, MorphoMarketMetrics>();
    const metricsById = new Map<string, MorphoMarketMetrics>();

    morpho?.markets?.forEach((market) => {
      if (market.raw?.uniqueKey) {
        metricsByUniqueKey.set(market.raw.uniqueKey, market);
      }
      metricsById.set(market.id, market);
    });

    return vault.allocation
      .filter((allocation) => allocation.marketKey)
      .map((allocation) => {
        let metrics = metricsByUniqueKey.get(allocation.marketKey!);
        if (!metrics && allocation.marketKey) {
          metrics = metricsById.get(allocation.marketKey);
        }

        const morphoState = metrics?.raw?.state;
        const totalSupplyUsd = morphoState?.supplyAssetsUsd ?? allocation.supplyAssetsUsd ?? null;
        const totalBorrowUsd = morphoState?.borrowAssetsUsd ?? null;
        const supplyApyValue = morphoState?.supplyApy ?? metrics?.supplyRate ?? null;
        const borrowApyValue = morphoState?.borrowApy ?? metrics?.borrowRate ?? null;
        const utilizationValue = morphoState?.utilization ?? metrics?.utilization ?? null;

        return {
          marketKey: allocation.marketKey!,
          collateralSymbol: metrics?.raw?.collateralAsset?.symbol ?? allocation.collateralAssetName ?? 'Unknown',
          loanSymbol: metrics?.raw?.loanAsset?.symbol ?? allocation.loanAssetName ?? 'Unknown',
          totalSupplyUsd,
          totalBorrowUsd,
          supplyApyPercent: supplyApyValue !== null ? supplyApyValue * 100 : null,
          borrowApyPercent: borrowApyValue !== null ? borrowApyValue * 100 : null,
          utilizationPercent: utilizationValue !== null ? utilizationValue * 100 : null,
          rating: metrics?.rating ?? null,
        };
      });
  }, [vault?.allocation, morpho?.markets]);

  if (isLoading) {
    return (
      <AppShell title="Loading vault..." description="Fetching vault data">
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="h-24 rounded-xl bg-slate-100" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (!vault) {
    return (
      <AppShell title="Vault not found" description="The vault you're looking for doesn't exist.">
        <Card>
          <CardHeader>
            <CardTitle>Missing vault</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Check the address or pick a vault from the sidebar.</p>
            <Button asChild>
              <Link href="/vaults">Back to vaults</Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const ratingLabel = vault.riskTier ? vault.riskTier.toUpperCase() : 'N/A';
  const vaultConfig = getVaultByAddress(vault.address);
  const vaultVersion = vaultConfig?.version ?? 'v2';

  return (
    <AppShell
      title={vault.name}
      description={`${vault.symbol} • ${vault.asset ?? ''}`}
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Shield className="h-3 w-3" /> {vaultVersion}
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <a href={vault.scanUrl} target="_blank" rel="noreferrer">
              View on Base
            </a>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Badge variant="secondary" className="text-xs">
            {vault.status}
          </Badge>
          <Badge variant="outline">{vault.asset}</Badge>
          <AddressBadge address={vault.address} scanUrl={vault.scanUrl} />
          <Badge variant="outline" className="flex items-center gap-1">
            <Wallet className="h-3 w-3" />
            Base
          </Badge>
        </div>

        <Tabs defaultValue="risk" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="risk">Risk Management</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="adapters">Adapters</TabsTrigger>
            <TabsTrigger value="allocation">Allocation</TabsTrigger>
            <TabsTrigger value="caps">Caps</TabsTrigger>
            <TabsTrigger value="timelocks">Timelocks</TabsTrigger>
          </TabsList>

          <TabsContent value="risk" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Risk management rating</CardTitle>
                  <p className="text-sm text-slate-500">Curator risk posture and key signals</p>
                </div>
                <RatingBadge rating={riskLoading ? null : riskSummary.rating} />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase text-slate-500">Rating</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {riskLoading
                      ? 'Loading...'
                      : riskSummary.rating !== null
                        ? `${riskSummary.rating} / 100`
                        : ratingLabel}
                  </p>
                  <p className="text-xs text-slate-500">
                    {riskSummary.marketsRated > 0
                      ? `Averaged across ${riskSummary.marketsRated} rated markets`
                      : 'Fallback to configured risk tier'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase text-slate-500">Timelock posture</p>
                  <p className="text-lg font-semibold text-slate-900">Pending / Scheduled</p>
                  <p className="text-xs text-slate-500">View in Timelocks tab</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase text-slate-500">Liquidity & caps</p>
                  <p className="text-lg font-semibold text-slate-900">Monitored</p>
                  <p className="text-xs text-slate-500">Idle, caps, utilization tracked</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard title="TVL" value={vault.tvl} subtitle="Total Value Locked" format="usd" />
              <KpiCard title="APY" value={vault.apy} subtitle="Current yield rate" format="percentage" />
              <KpiCard title="Depositors" value={vault.depositors} subtitle="Total depositors" format="number" />
              <KpiCard 
                title="Performance Fee" 
                value={vault.parameters?.performanceFeeBps ? vault.parameters.performanceFeeBps / 100 : null} 
                subtitle="Curator fee rate" 
                format="percentage" 
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <KpiCard title="Revenue (All Time)" value={vault.revenueAllTime} subtitle="Interest generated for depositors" format="usd" />
              <KpiCard title="Fees (All Time)" value={vault.feesAllTime} subtitle="Curator fees collected" format="usd" />
            </div>
          </TabsContent>

          <TabsContent value="roles">
            <div className="grid gap-6 md:grid-cols-2">
              <RoleList />
              <AllocatorList />
            </div>
          </TabsContent>

          <TabsContent value="adapters" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Adapters</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                Adapter registry and configuration pulls from Morpho vault contracts. Use caps and timelocks tabs to change allocations and timing.
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allocation" className="space-y-4">
            {vaultMarkets.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Market Allocation</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px]">Market Pair</TableHead>
                        <TableHead className="min-w-[140px]">Total Supply</TableHead>
                        <TableHead className="min-w-[140px]">Total Borrow</TableHead>
                        <TableHead className="min-w-[120px]">Supply APY</TableHead>
                        <TableHead className="min-w-[120px]">Borrow APY</TableHead>
                        <TableHead className="min-w-[120px]">Utilization</TableHead>
                        <TableHead className="min-w-[140px]">Curator Rating</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vaultMarkets.map((market) => (
                        <TableRow key={market.marketKey}>
                          <TableCell className="font-medium">
                            <Link href={`/markets/${market.marketKey}`} className="flex items-center gap-2 hover:underline">
                              <span>{market.collateralSymbol}</span>
                              <span className="text-muted-foreground">/</span>
                              <span>{market.loanSymbol}</span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            {market.totalSupplyUsd !== null ? formatCompactUSD(market.totalSupplyUsd) : '—'}
                          </TableCell>
                          <TableCell>
                            {market.totalBorrowUsd !== null ? formatCompactUSD(market.totalBorrowUsd) : '—'}
                          </TableCell>
                          <TableCell className="text-green-600 dark:text-green-400">
                            {market.supplyApyPercent !== null ? formatPercentage(market.supplyApyPercent, 2) : '—'}
                          </TableCell>
                          <TableCell className="text-orange-600 dark:text-orange-400">
                            {market.borrowApyPercent !== null ? formatPercentage(market.borrowApyPercent, 2) : '—'}
                          </TableCell>
                          <TableCell>
                            {market.utilizationPercent !== null ? formatPercentage(market.utilizationPercent, 2) : '—'}
                          </TableCell>
                          <TableCell>
                            {market.rating !== null ? (
                              <RatingBadge rating={market.rating} />
                            ) : (
                              <span className="text-xs text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No allocations found</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">This vault has no allocations yet.</CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="caps" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Caps</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                Configure absolute and relative caps per adapter. Pull data from Morpho vault V2 for v2 vaults and MetaMorpho v1.1 for v1 vaults.
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timelocks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Timelocks</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                Pending actions will surface here once wired to contract reads. Execute after timelock expiry or revoke if needed.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
