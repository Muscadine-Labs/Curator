'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Minus, ExternalLink } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vaults } from '@/lib/config/vaults';
import { useMarketsSupplied, SuppliedMarket } from '@/lib/hooks/useMarkets';
import { useMorphoMarkets } from '@/lib/hooks/useMorphoMarkets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WalletConnect } from '@/components/WalletConnect';
import { RatingBadge } from '@/components/morpho/RatingBadge';
import { formatCompactUSD, formatPercentage, formatRelativeTime } from '@/lib/format/number';

type AllocationAction =
  | {
      type: 'allocate';
      vaultAddress: string;
      vaultName: string;
      vaultSymbol: string;
      marketKey: string;
      marketLabel: string;
      market: SuppliedMarket | null;
      currentAllocationUsd: number;
      currentSharePct: number;
      basisUsd: number;
      basisLabel: string;
      isNewMarket: boolean;
    }
  | {
      type: 'deallocate';
      vaultAddress: string;
      vaultName: string;
      vaultSymbol: string;
      marketKey: string;
      marketLabel: string;
      market: SuppliedMarket | null;
      currentAllocationUsd: number;
      currentSharePct: number;
      basisUsd: number;
      basisLabel: string;
      isNewMarket: false;
    };

type AllocationIntent = {
  id: string;
  vaultAddress: string;
  marketKey: string;
  action: 'allocate' | 'deallocate';
  amountUsd?: number | null;
  sharePct?: number | null;
  walletAddress?: string | null;
  createdAt: string;
};

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
  availableMarkets: SuppliedMarket[];
};

const fetchIntents = async (): Promise<{ intents: AllocationIntent[] }> => {
  const res = await fetch('/api/allocations/intents');
  if (!res.ok) {
    throw new Error('Failed to load allocation intents');
  }
  return res.json();
};

export default function AllocationsPage() {
  const markets = useMarketsSupplied();
  const morpho = useMorphoMarkets();
  const queryClient = useQueryClient();
  const { address: walletAddress } = useAccount();

  const [activeVaultAddress, setActiveVaultAddress] = useState<string>(() => vaults[0]?.address ?? '');
  const [action, setAction] = useState<AllocationAction | null>(null);
  const [amountInput, setAmountInput] = useState<string>('');
  const [shareInput, setShareInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const intents = useQuery({
    queryKey: ['allocation-intents'],
    queryFn: fetchIntents,
    staleTime: 30 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async (payload: {
      vaultAddress: string;
      marketKey: string;
      action: 'allocate' | 'deallocate';
      amountUsd?: number;
      sharePct?: number;
      notes?: string;
    }) => {
      const res = await fetch('/api/allocations/intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, walletAddress }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to submit allocation intent');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocation-intents'] });
      setFeedback({ type: 'success', message: 'Allocation intent recorded' });
      setAction(null);
      setAmountInput('');
      setShareInput('');
      setNotes('');
    },
    onError: (error: Error) => {
      setFeedback({ type: 'error', message: error.message });
    },
  });

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [feedback]);

  const morphoByKey = useMemo(() => {
    const map = new Map<string, { rating: number | null; supplyRate: number | null; utilization: number | null }>();
    
    morpho.data?.markets.forEach((m) => {
      const metrics = {
        rating: m.rating ?? null,
        supplyRate: m.supplyRate ?? null,
        utilization: m.utilization ?? null,
      };
      
      // Primary: match by uniqueKey from raw Market object
      if (m.raw?.uniqueKey) {
        map.set(m.raw.uniqueKey, metrics);
      }
      // Also add by id as fallback
      map.set(m.id, metrics);
    });
    
    return map;
  }, [morpho.data?.markets]);

  const allocationData = useMemo(() => {
    if (!markets.data) return new Map<string, VaultAllocationData>();

    const suppliedByKey = new Map(markets.data.markets.map((m) => [m.uniqueKey, m]));
    const availableByKey = new Map(markets.data.availableMarkets.map((m) => [m.uniqueKey, m]));

    const result = new Map<string, VaultAllocationData>();

    vaults.forEach((vault) => {
      const allocation = markets.data?.vaultAllocations.find(
        (va) => va.address.toLowerCase() === vault.address.toLowerCase()
      );

      const rows: AllocationRow[] =
        allocation?.allocations.map((entry) => {
          const market =
            suppliedByKey.get(entry.marketKey) ||
            availableByKey.get(entry.marketKey) ||
            null;
          // Try to match by uniqueKey first, then fallback to id
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

      const allocatedKeys = new Set(rows.map((row) => row.marketKey));
      const candidateMarkets = markets.data.availableMarkets.filter((market) => {
        if (!market.collateralAsset?.symbol) return false;
        if (allocatedKeys.has(market.uniqueKey)) return false;
        return market.collateralAsset.symbol.toLowerCase() === vault.asset.toLowerCase();
      });

      result.set(vault.address.toLowerCase(), {
        vaultAddress: vault.address,
        vaultName: vault.name,
        vaultSymbol: vault.symbol,
        version: vault.version ?? 'v1',
        totalSupplyUsd: allocation?.totalSupplyUsd ?? 0,
        rows,
        availableMarkets: candidateMarkets.slice(0, 12),
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

  const handleShareChange = (value: string) => {
    setShareInput(value);
    if (!action) return;
    const pct = parseFloat(value);
    if (!Number.isFinite(pct) || pct < 0) {
      setAmountInput('');
      return;
    }
    const amount = action.basisUsd > 0 ? (pct / 100) * action.basisUsd : 0;
    setAmountInput(amount ? amount.toFixed(2) : '');
  };

  const handleAmountChange = (value: string) => {
    setAmountInput(value);
    if (!action) return;
    const amount = parseFloat(value);
    if (!Number.isFinite(amount) || amount < 0) {
      setShareInput('');
      return;
    }
    const pct = action.basisUsd > 0 ? (amount / action.basisUsd) * 100 : 0;
    setShareInput(pct ? pct.toFixed(2) : '');
  };

  const submitAction = () => {
    if (!action) return;
    const amountNum = parseFloat(amountInput);
    const shareNum = parseFloat(shareInput);
    if (
      (!Number.isFinite(amountNum) || amountNum <= 0) &&
      (!Number.isFinite(shareNum) || shareNum <= 0)
    ) {
      setFeedback({ type: 'error', message: 'Please enter an amount or percentage greater than zero.' });
      return;
    }
    mutation.mutate({
      vaultAddress: action.vaultAddress,
      marketKey: action.marketKey,
      action: action.type,
      amountUsd: Number.isFinite(amountNum) && amountNum > 0 ? amountNum : undefined,
      sharePct: Number.isFinite(shareNum) && shareNum > 0 ? shareNum : undefined,
      notes: notes || undefined,
    });
  };

  const openAllocate = (
    marketKey: string,
    market: SuppliedMarket | null,
    isNew: boolean,
    defaults?: { allocationUsd: number; sharePct: number }
  ) => {
    if (!selectedVault || !selectedAllocation) return;
    const currentAllocationUsd = defaults?.allocationUsd ?? 0;
    const currentSharePct = defaults?.sharePct ?? 0;
    const marketLabel = market
      ? `${market.collateralAsset?.symbol ?? 'Unknown'} / ${market.loanAsset?.symbol ?? 'Unknown'}`
      : defaults
      ? 'Unknown'
      : 'New Market';
    const basisUsd = selectedAllocation.totalSupplyUsd || 0;
    setAction({
      type: 'allocate',
      vaultAddress: selectedVault.address,
      vaultName: selectedVault.name,
      vaultSymbol: selectedVault.symbol,
      marketKey,
      marketLabel,
      market,
      currentAllocationUsd,
      currentSharePct,
      basisUsd,
      basisLabel: 'Total Vault TVL',
      isNewMarket: isNew,
    });
    setAmountInput('');
    setShareInput('');
    setNotes('');
  };

  const openDeallocate = (row: AllocationRow) => {
    if (!selectedVault || !selectedAllocation) return;
    const market = row.market ?? null;
    const marketLabel = market
      ? `${market.collateralAsset?.symbol ?? 'Unknown'} / ${market.loanAsset?.symbol ?? 'Unknown'}`
      : row.marketKey;
    setAction({
      type: 'deallocate',
      vaultAddress: selectedVault.address,
      vaultName: selectedVault.name,
      vaultSymbol: selectedVault.symbol,
      marketKey: row.marketKey,
      market,
      marketLabel,
      currentAllocationUsd: row.allocationUsd,
      currentSharePct: row.sharePct,
      basisUsd: row.allocationUsd,
      basisLabel: 'Current Market Allocation',
      isNewMarket: false,
    });
    setAmountInput('');
    setShareInput('');
    setNotes('');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
                  Allocate or deallocate liquidity across Morpho markets for Muscadine Prime and V1 vaults.
                </p>
              </div>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {feedback ? (
          <Card className={feedback.type === 'success' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-red-500/50 bg-red-500/5'}>
            <CardContent className="py-4">
              <p className="text-sm font-medium">{feedback.message}</p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Vault Selector</CardTitle>
            <CardDescription>Choose a vault to manage its market allocations.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeVaultAddress}
              onValueChange={(value) => setActiveVaultAddress(value)}
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
                    <div className="grid gap-6">
                      <Card className="border-primary/30 bg-primary/5">
                        <CardHeader>
                          <CardTitle>{vault.name}</CardTitle>
                          <CardDescription className="flex flex-wrap items-center gap-3">
                            <Badge variant="outline">{vault.version?.toUpperCase() ?? 'V1'}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {vault.address}
                            </span>
                            <Link
                              href={vault.scanUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              View on Basescan
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <SummaryStat label="Total Supplied" value={formatCompactUSD(data?.totalSupplyUsd ?? 0)} />
                          <SummaryStat label="Active Markets" value={(data?.rows.length ?? 0).toString()} />
                          <SummaryStat label="Actionable Markets" value={(data?.availableMarkets.length ?? 0).toString()} />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Current Allocations</CardTitle>
                          <CardDescription>
                            Active markets receiving liquidity for {vault.symbol}. Trigger adjustments per market below.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="min-w-[180px]">Market Pair</TableHead>
                                  <TableHead className="min-w-[140px] text-right">Allocated</TableHead>
                                  <TableHead className="min-w-[120px] text-right">Share</TableHead>
                                  <TableHead className="min-w-[110px] text-right">Supply APY</TableHead>
                                  <TableHead className="min-w-[110px] text-right">Utilization</TableHead>
                                  <TableHead className="min-w-[120px]">Curator Rating</TableHead>
                                  <TableHead className="min-w-[180px] text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {data && data.rows.length > 0 ? (
                                  data.rows.map((row) => {
                                    const market = row.market;
                                    const supplyApyPercent =
                                      row.supplyApy !== null ? row.supplyApy * 100 : null;
                                    const utilizationPercent =
                                      row.utilization !== null ? row.utilization * 100 : null;
                                    return (
                                      <TableRow key={row.marketKey}>
                                        <TableCell>
                                          <div className="flex flex-col">
                                            <span className="font-medium">
                                              {market
                                                ? `${market.collateralAsset?.symbol ?? 'Unknown'} / ${market.loanAsset?.symbol ?? 'Unknown'}`
                                                : row.marketKey}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              {row.marketKey}
                                            </span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {formatCompactUSD(row.allocationUsd)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {formatPercentage(row.sharePct * 100, 2)}
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
                                        <TableCell className="text-right">
                                          <div className="flex justify-end gap-2">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() =>
                                                openAllocate(
                                                  row.marketKey,
                                                  market,
                                                  false,
                                                  {
                                                    allocationUsd: row.allocationUsd,
                                                    sharePct: row.sharePct * 100,
                                                  }
                                                )
                                              }
                                            >
                                              <Plus className="h-4 w-4" />
                                              Allocate
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => openDeallocate(row)}
                                              disabled={row.allocationUsd <= 0}
                                            >
                                              <Minus className="h-4 w-4" />
                                              Deallocate
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                                      No active allocations for this vault yet.
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Available Markets</CardTitle>
                          <CardDescription>
                            Morpho markets on Base matching {vault.asset}. Allocate to open new exposures.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {data && data.availableMarkets.length > 0 ? (
                            data.availableMarkets.map((market) => (
                              <Card key={market.uniqueKey} className="border-dashed border-border/60">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-base">
                                    {market.collateralAsset?.symbol ?? 'Unknown'} / {market.loanAsset?.symbol ?? 'Unknown'}
                                  </CardTitle>
                                  <CardDescription className="text-xs">
                                    {market.uniqueKey}
                                  </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Supply APY</span>
                                    <span className="text-green-600 dark:text-green-400">
                                      {market.state?.supplyApy
                                        ? formatPercentage(market.state.supplyApy * 100, 2)
                                        : '—'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Utilization</span>
                                    <span>
                                      {market.state?.utilization
                                        ? formatPercentage(market.state.utilization * 100, 2)
                                        : '—'}
                                    </span>
                                  </div>
                                  <Button
                                    size="sm"
                                    className="w-full"
                                    variant="outline"
                                    onClick={() => openAllocate(market.uniqueKey, market, true)}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Allocate
                                  </Button>
                                </CardContent>
                              </Card>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No additional markets detected for this collateral asset.
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>

        {action ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {action.type === 'allocate' ? 'Allocate Liquidity' : 'Deallocate Liquidity'}
              </CardTitle>
              <CardDescription>
                {action.vaultName} · {action.marketLabel}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Amount (USD)"
                  description={`Based on ${action.basisLabel.toLowerCase()}`}
                >
                  <input
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountInput}
                    onChange={(event) => handleAmountChange(event.target.value)}
                    placeholder="0.00"
                  />
                </Field>
                <Field
                  label="Share (%)"
                  description={
                    action.type === 'allocate'
                      ? 'Percentage of vault TVL to allocate'
                      : 'Percentage of the current market allocation to pull back'
                  }
                >
                  <input
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type="number"
                    min="0"
                    step="0.01"
                    value={shareInput}
                    onChange={(event) => handleShareChange(event.target.value)}
                    placeholder="0.00"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[5, 10, 25, 50, 100].map((preset) => (
                  <Button
                    key={preset}
                    variant="outline"
                    onClick={() => handleShareChange(String(preset))}
                  >
                    {preset}%
                  </Button>
                ))}
              </div>
              <Field label="Notes" description="Optional context for this intent">
                <textarea
                  className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Reason for allocation change, counterparties, hedges, etc."
                />
              </Field>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setAction(null)}>
                  Cancel
                </Button>
                <Button onClick={submitAction} disabled={mutation.isPending}>
                  {mutation.isPending ? 'Submitting...' : 'Record Intent'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Recent Allocation Intents</CardTitle>
            <CardDescription>
              Logged allocation and deallocation requests. This feed resets on server restart.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Vault</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="text-right">Amount (USD)</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                    <TableHead>Wallet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {intents.data?.intents && intents.data.intents.length > 0 ? (
                    intents.data.intents.map((intent) => {
                      const vault = vaults.find(
                        (v) => v.address.toLowerCase() === intent.vaultAddress.toLowerCase()
                      );
                      return (
                        <TableRow key={intent.id}>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatRelativeTime(intent.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {vault?.symbol ?? 'Unknown'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {intent.vaultAddress}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {intent.marketKey}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={intent.action === 'allocate' ? 'outline' : 'secondary'}
                              className={
                                intent.action === 'allocate'
                                  ? 'border-emerald-500/60 text-emerald-600 dark:text-emerald-400'
                                  : 'border-red-500/60 text-red-600 dark:text-red-400'
                              }
                            >
                              {intent.action.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {intent.amountUsd ? formatCompactUSD(intent.amountUsd) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {intent.sharePct ? formatPercentage(intent.sharePct, 2) : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {intent.walletAddress ? `${intent.walletAddress.slice(0, 6)}...${intent.walletAddress.slice(-4)}` : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        No allocation intents recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 px-4 py-3">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-semibold text-foreground">{label}</label>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}


