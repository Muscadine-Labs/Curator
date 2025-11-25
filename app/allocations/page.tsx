'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vaults } from '@/lib/config/vaults';
import { useMarketsSupplied, SuppliedMarket } from '@/lib/hooks/useMarkets';
import { useMorphoMarkets } from '@/lib/hooks/useMorphoMarkets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WalletConnect } from '@/components/WalletConnect';
import { RatingBadge } from '@/components/morpho/RatingBadge';
import { formatCompactUSD, formatPercentage } from '@/lib/format/number';
import { Alert, AlertDescription } from '@/components/ui/alert';

type AllocationRow = {
  marketKey: string;
  allocationUsd: number;
  sharePct: number;
  market: SuppliedMarket | null;
  rating: number | null;
  supplyApy: number | null;
  utilization: number | null;
};

type VaultAllocationData = {
  vaultAddress: string;
  vaultName: string;
  vaultSymbol: string;
  version: 'v1' | 'v2';
  totalSupplyUsd: number;
  rows: AllocationRow[];
};

type MarketAllocationEdit = {
  marketKey: string;
  currentSharePct: number;
  newSharePct: number;
};

export default function AllocationsPage() {
  const markets = useMarketsSupplied();
  const morpho = useMorphoMarkets();
  const queryClient = useQueryClient();
  const { address: walletAddress, isConnected } = useAccount();

  const [activeVaultAddress, setActiveVaultAddress] = useState<string>(() => vaults[0]?.address ?? '');
  const [edits, setEdits] = useState<Map<string, MarketAllocationEdit>>(new Map());
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const morphoByKey = useMemo(() => {
    const map = new Map<string, { rating: number | null; supplyRate: number | null; utilization: number | null }>();
    
    morpho.data?.markets.forEach((m) => {
      const metrics = {
        rating: m.rating ?? null,
        supplyRate: m.supplyRate ?? null,
        utilization: m.utilization ?? null,
      };
      
      if (m.raw?.uniqueKey) {
        map.set(m.raw.uniqueKey, metrics);
      }
      map.set(m.id, metrics);
    });
    
    return map;
  }, [morpho.data?.markets]);

  const allocationData = useMemo(() => {
    if (!markets.data) return new Map<string, VaultAllocationData>();

    const suppliedByKey = new Map(markets.data.markets.map((m) => [m.uniqueKey, m]));

    const result = new Map<string, VaultAllocationData>();

    vaults.forEach((vault) => {
      const allocation = markets.data?.vaultAllocations.find(
        (va) => va.address.toLowerCase() === vault.address.toLowerCase()
      );

      const rows: AllocationRow[] =
        allocation?.allocations.map((entry) => {
          const market = suppliedByKey.get(entry.marketKey) || null;
          const morphoMetrics = morphoByKey.get(entry.marketKey) ?? null;
          return {
            marketKey: entry.marketKey,
            allocationUsd: entry.supplyAssetsUsd ?? 0,
            sharePct: entry.sharePct ?? 0,
            market,
            rating: morphoMetrics?.rating ?? null,
            supplyApy: morphoMetrics?.supplyRate ?? market?.state?.supplyApy ?? null,
            utilization: morphoMetrics?.utilization ?? market?.state?.utilization ?? null,
          };
        }) ?? [];

      result.set(vault.address.toLowerCase(), {
        vaultAddress: vault.address,
        vaultName: vault.name,
        vaultSymbol: vault.symbol,
        version: vault.version ?? 'v1',
        totalSupplyUsd: allocation?.totalSupplyUsd ?? 0,
        rows,
      });
    });

    return result;
  }, [markets.data, morphoByKey]);

  useEffect(() => {
    if (!allocationData.has(activeVaultAddress.toLowerCase()) && vaults.length > 0) {
      setActiveVaultAddress(vaults[0].address);
    }
  }, [allocationData, activeVaultAddress]);

  const selectedVault = useMemo(() => {
    return vaults.find((vault) => vault.address === activeVaultAddress) ?? vaults[0];
  }, [activeVaultAddress]);

  const selectedAllocation = useMemo(() => {
    if (!selectedVault) return null;
    return allocationData.get(selectedVault.address.toLowerCase()) ?? null;
  }, [allocationData, selectedVault]);

  const handleShareChange = (marketKey: string, newSharePct: number) => {
    if (!selectedAllocation) return;
    
    const row = selectedAllocation.rows.find((r) => r.marketKey === marketKey);
    if (!row) return;

    const clampedValue = Math.max(0, Math.min(100, newSharePct));
    const newEdits = new Map(edits);
    
    if (clampedValue === row.sharePct * 100) {
      newEdits.delete(marketKey);
    } else {
      newEdits.set(marketKey, {
        marketKey,
        currentSharePct: row.sharePct * 100,
        newSharePct: clampedValue,
      });
    }
    
    setEdits(newEdits);
  };

  const getTotalShare = () => {
    if (!selectedAllocation) return 0;
    let total = 0;
    selectedAllocation.rows.forEach((row) => {
      const edit = edits.get(row.marketKey);
      total += edit ? edit.newSharePct : row.sharePct * 100;
    });
    return total;
  };

  const hasChanges = edits.size > 0;
  const totalShare = getTotalShare();
  const shareError = Math.abs(totalShare - 100) > 0.01;

  const mutation = useMutation({
    mutationFn: async (payload: {
      vaultAddress: string;
      allocations: Array<{ marketKey: string; sharePct: number }>;
    }) => {
      const res = await fetch('/api/allocations/intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultAddress: payload.vaultAddress,
          marketKey: payload.allocations[0]?.marketKey || '',
          action: 'allocate',
          sharePct: payload.allocations[0]?.sharePct || 0,
          walletAddress,
          notes: `Reallocation: ${payload.allocations.length} markets adjusted`,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to submit reallocation');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocation-intents'] });
      queryClient.invalidateQueries({ queryKey: ['markets-supplied'] });
      setFeedback({ type: 'success', message: 'Reallocation submitted successfully' });
      setEdits(new Map());
      setTimeout(() => setFeedback(null), 5000);
    },
    onError: (error: Error) => {
      setFeedback({ type: 'error', message: error.message });
      setTimeout(() => setFeedback(null), 5000);
    },
  });

  const handleReallocate = () => {
    if (!selectedAllocation || !hasChanges || shareError) return;

    const allocations = selectedAllocation.rows.map((row) => {
      const edit = edits.get(row.marketKey);
      return {
        marketKey: row.marketKey,
        sharePct: edit ? edit.newSharePct : row.sharePct * 100,
      };
    });

    mutation.mutate({
      vaultAddress: selectedAllocation.vaultAddress,
      allocations,
    });
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/vaults" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Vaults
                  </Link>
                </Button>
                <div>
                  <h1 className="text-3xl font-bold">Vault Allocations</h1>
                  <p className="text-muted-foreground mt-1">
                    Manage liquidity allocation across Morpho markets
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="outline" asChild>
                  <Link href="/">Home</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/vaults">Vaults</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/fees">Fee Splitter</Link>
                </Button>
                <WalletConnect />
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-lg text-muted-foreground mb-4">
                Please connect your wallet to manage allocations
              </p>
              <WalletConnect />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/vaults" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Vaults
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Vault Allocations</h1>
                <p className="text-muted-foreground mt-1">
                  Adjust allocation percentages and reallocate funds
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" asChild>
                <Link href="/">Home</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/vaults">Vaults</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/fees">Fee Splitter</Link>
              </Button>
              <WalletConnect />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {feedback && (
          <Alert className={feedback.type === 'success' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-red-500/50 bg-red-500/5'}>
            <AlertDescription>{feedback.message}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Select Vault</CardTitle>
            <CardDescription>Choose a vault to manage its market allocations</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeVaultAddress}
              onValueChange={(value) => {
                setActiveVaultAddress(value);
                setEdits(new Map());
              }}
            >
              <TabsList className="flex-wrap">
                {vaults.map((vault) => (
                  <TabsTrigger key={vault.address} value={vault.address}>
                    {vault.symbol}
                    <Badge variant="outline" className="ml-2">
                      {vault.version?.toUpperCase() ?? 'V1'}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
              {vaults.map((vault) => {
                const data = allocationData.get(vault.address.toLowerCase());
                return (
                  <TabsContent key={vault.address} value={vault.address}>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 px-4 py-3">
                          <div className="text-xs font-medium uppercase text-muted-foreground">Total Supplied</div>
                          <div className="text-2xl font-semibold">{formatCompactUSD(data?.totalSupplyUsd ?? 0)}</div>
                        </div>
                        <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 px-4 py-3">
                          <div className="text-xs font-medium uppercase text-muted-foreground">Active Markets</div>
                          <div className="text-2xl font-semibold">{(data?.rows.length ?? 0).toString()}</div>
                        </div>
                        <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 px-4 py-3">
                          <div className="text-xs font-medium uppercase text-muted-foreground">Total Allocation</div>
                          <div className={`text-2xl font-semibold ${shareError ? 'text-red-600 dark:text-red-400' : ''}`}>
                            {formatPercentage(totalShare, 2)}
                          </div>
                        </div>
                      </div>

                      {selectedAllocation && selectedAllocation.rows.length > 0 ? (
                        <>
                          <Card>
                            <CardHeader>
                              <CardTitle>Market Allocations</CardTitle>
                              <CardDescription>
                                Adjust the percentage share for each market. Total must equal 100%.
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="min-w-[200px]">Market Pair</TableHead>
                                      <TableHead className="min-w-[120px] text-right">Current Share</TableHead>
                                      <TableHead className="min-w-[140px] text-right">New Share (%)</TableHead>
                                      <TableHead className="min-w-[120px] text-right">Supply APY</TableHead>
                                      <TableHead className="min-w-[120px] text-right">Utilization</TableHead>
                                      <TableHead className="min-w-[120px]">Rating</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {selectedAllocation.rows.map((row) => {
                                      const edit = edits.get(row.marketKey);
                                      const displayShare = edit ? edit.newSharePct : row.sharePct * 100;
                                      const hasChange = edit !== undefined;
                                      const market = row.market;
                                      const supplyApyPercent = row.supplyApy !== null ? row.supplyApy * 100 : null;
                                      const utilizationPercent = row.utilization !== null ? row.utilization * 100 : null;

                                      return (
                                        <TableRow key={row.marketKey} className={hasChange ? 'bg-muted/40' : ''}>
                                          <TableCell>
                                            <div className="flex flex-col">
                                              <span className="font-medium">
                                                {market
                                                  ? `${market.collateralAsset?.symbol ?? 'Unknown'} / ${market.loanAsset?.symbol ?? 'Unknown'}`
                                                  : row.marketKey}
                                              </span>
                                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                {row.marketKey}
                                              </span>
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <span className={hasChange ? 'line-through text-muted-foreground' : ''}>
                                              {formatPercentage(row.sharePct * 100, 2)}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                              <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                value={displayShare.toFixed(2)}
                                                onChange={(e) => {
                                                  const value = parseFloat(e.target.value);
                                                  if (!isNaN(value)) {
                                                    handleShareChange(row.marketKey, value);
                                                  }
                                                }}
                                                className="w-24 text-right"
                                              />
                                              <span className="text-sm text-muted-foreground">%</span>
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-right text-green-600 dark:text-green-400">
                                            {supplyApyPercent !== null
                                              ? formatPercentage(supplyApyPercent, 2)
                                              : '—'}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            {utilizationPercent !== null
                                              ? formatPercentage(utilizationPercent, 2)
                                              : '—'}
                                          </TableCell>
                                          <TableCell>
                                            {row.rating !== null ? (
                                              <RatingBadge rating={row.rating} />
                                            ) : (
                                              <span className="text-xs text-muted-foreground">N/A</span>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </CardContent>
                          </Card>

                          {shareError && (
                            <Alert className="border-amber-500/50 bg-amber-500/5">
                              <AlertDescription>
                                Total allocation must equal 100%. Current total: {formatPercentage(totalShare, 2)}
                              </AlertDescription>
                            </Alert>
                          )}

                          <div className="flex justify-end gap-3">
                            {hasChanges && (
                              <Button
                                variant="ghost"
                                onClick={() => setEdits(new Map())}
                                disabled={mutation.isPending}
                              >
                                Reset Changes
                              </Button>
                            )}
                            <Button
                              onClick={handleReallocate}
                              disabled={!hasChanges || shareError || mutation.isPending}
                              size="lg"
                            >
                              {mutation.isPending ? 'Reallocating...' : 'Reallocate'}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <Card>
                          <CardContent className="py-16 text-center">
                            <p className="text-muted-foreground">
                              No active allocations for this vault yet.
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
