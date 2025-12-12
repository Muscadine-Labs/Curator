'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Shield, Wallet, Clock } from 'lucide-react';
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

export default function V2VaultPage() {
  const params = useParams();
  const address = params.address as string;
  const { data: vault, isLoading } = useVault(address);
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
          supplyCap: allocation.supplyCap ?? null,
          supplyAssetsUsd: allocation.supplyAssetsUsd ?? null,
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
              <Link href="/">Back to overview</Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const ratingLabel = vault.riskTier ? vault.riskTier.toUpperCase() : 'N/A';
  const vaultConfig = getVaultByAddress(vault.address);

  return (
    <AppShell
      title={vault.name}
      description={`${vault.symbol} • ${vault.asset ?? ''}`}
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="default" className="flex items-center gap-1 bg-blue-600">
            <Shield className="h-3 w-3" /> V2 Prime
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

        {/* V2 Tabs: Overview, Risk Management, Roles, Adapters, Allocations, Caps, Timelock */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="risk">Risk Management</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="adapters">Adapters</TabsTrigger>
            <TabsTrigger value="allocation">Allocations</TabsTrigger>
            <TabsTrigger value="caps">Caps</TabsTrigger>
            <TabsTrigger value="timelock">Timelock</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard title="TVL" value={vault.tvl} subtitle="Total Value Locked" format="usd" />
              <KpiCard title="APY" value={vault.apy} subtitle="Current yield rate" format="percentage" />
              <KpiCard title="Depositors" value={vault.depositors} subtitle="Total depositors" format="number" />
              <KpiCard 
                title="Performance Fee" 
                value={(vault.parameters?.performanceFeeBps ?? vaultConfig?.performanceFeeBps ?? 200) / 100} 
                subtitle="Curator fee" 
                format="percentage" 
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <KpiCard title="Revenue (All Time)" value={vault.revenueAllTime} subtitle="Interest generated for depositors" format="usd" />
              <KpiCard title="Fees (All Time)" value={vault.feesAllTime} subtitle="Curator fees collected" format="usd" />
            </div>
          </TabsContent>

          {/* Risk Management Tab */}
          <TabsContent value="risk" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Risk Management Rating</CardTitle>
                  <p className="text-sm text-slate-500">V2 enhanced risk controls and monitoring</p>
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
                  <p className="text-xs uppercase text-slate-500">Timelock Status</p>
                  <p className="text-lg font-semibold text-slate-900">Active</p>
                  <p className="text-xs text-slate-500">Pending actions in Timelock tab</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase text-slate-500">Markets Allocated</p>
                  <p className="text-lg font-semibold text-slate-900">{vaultMarkets.length}</p>
                  <p className="text-xs text-slate-500">Active market allocations</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles">
            <div className="grid gap-6 md:grid-cols-2">
              <RoleList />
              <AllocatorList />
            </div>
          </TabsContent>

          {/* Adapters Tab (V2 specific) */}
          <TabsContent value="adapters" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>V2 Adapters</CardTitle>
                <p className="text-sm text-slate-500">Morpho V2 vault adapter configuration</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase text-slate-500">Primary Adapter</p>
                    <p className="text-lg font-semibold text-slate-900">MetaMorpho V2</p>
                    <p className="text-xs text-slate-500">Enhanced flexibility and controls</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase text-slate-500">Allocator Type</p>
                    <p className="text-lg font-semibold text-slate-900">Multi-Allocator</p>
                    <p className="text-xs text-slate-500">Supports public + private allocators</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase text-slate-500">Oracle Integration</p>
                    <p className="text-lg font-semibold text-slate-900">Morpho Oracle</p>
                    <p className="text-xs text-slate-500">Price feeds from Morpho markets</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase text-slate-500">Fee Receiver</p>
                    <p className="text-lg font-semibold text-slate-900">Fee Splitter V2</p>
                    <p className="text-xs text-slate-500">Automated fee distribution</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Allocations Tab */}
          <TabsContent value="allocation" className="space-y-4">
            {vaultMarkets.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Market Allocations</CardTitle>
                  <p className="text-sm text-slate-500">Current distribution across Morpho markets</p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[180px]">Market Pair</TableHead>
                          <TableHead className="min-w-[140px]">Supply</TableHead>
                          <TableHead className="min-w-[140px]">Borrow</TableHead>
                          <TableHead className="min-w-[120px]">Supply APY</TableHead>
                          <TableHead className="min-w-[120px]">Borrow APY</TableHead>
                          <TableHead className="min-w-[120px]">Utilization</TableHead>
                          <TableHead className="min-w-[140px]">Rating</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vaultMarkets.map((market) => (
                          <TableRow key={market.marketKey}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span>{market.collateralSymbol}</span>
                                <span className="text-muted-foreground">/</span>
                                <span>{market.loanSymbol}</span>
                              </div>
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
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Allocations</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  This vault has no active market allocations.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Caps Tab */}
          <TabsContent value="caps" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Supply Caps</CardTitle>
                <p className="text-sm text-slate-500">Maximum allocation limits per market</p>
              </CardHeader>
              <CardContent>
                {vaultMarkets.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Market</TableHead>
                          <TableHead>Current Supply</TableHead>
                          <TableHead>Supply Cap</TableHead>
                          <TableHead>Cap Utilization</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vaultMarkets.map((market) => (
                          <TableRow key={market.marketKey}>
                            <TableCell className="font-medium">
                              {market.collateralSymbol}/{market.loanSymbol}
                            </TableCell>
                            <TableCell>
                              {market.supplyAssetsUsd !== null ? formatCompactUSD(market.supplyAssetsUsd) : '—'}
                            </TableCell>
                            <TableCell>
                              {market.supplyCap !== null ? formatCompactUSD(market.supplyCap) : 'Unlimited'}
                            </TableCell>
                            <TableCell>
                              {market.supplyCap && market.supplyAssetsUsd
                                ? formatPercentage((market.supplyAssetsUsd / market.supplyCap) * 100, 1)
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">No market allocations to display caps for.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timelock Tab (V2 specific) */}
          <TabsContent value="timelock" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Timelock
                </CardTitle>
                <p className="text-sm text-slate-500">Pending governance actions and execution queue</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase text-slate-500">Timelock Duration</p>
                        <p className="text-lg font-semibold text-slate-900">
                          {vault.roles?.timelock ? '24 hours' : 'Not configured'}
                        </p>
                      </div>
                      <Badge variant="outline">Active</Badge>
                    </div>
                  </div>
                  
                  <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
                    <Clock className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-2 text-sm font-medium text-slate-900">No Pending Actions</p>
                    <p className="text-xs text-slate-500">
                      Timelock actions will appear here when queued
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
