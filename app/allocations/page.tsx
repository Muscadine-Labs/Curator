'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAccount, useWriteContract, useChainId, useSwitchChain, useWaitForTransactionReceipt } from 'wagmi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Address } from 'viem';
import { base } from 'viem/chains';
import { MORPHO_BLUE_VAULT_ALLOCATOR_ABI } from '@/lib/onchain/client';
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
  const { writeContractAsync, isPending: isTxPending, data: txHash } = useWriteContract();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

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

  // Calculate actual amounts from percentages
  const calculateAllocationAmounts = (
    allocations: Array<{ marketKey: string; sharePct: number }>,
    totalSupplyUsd: number
  ) => {
    return allocations.map((alloc) => {
      const amountUsd = (totalSupplyUsd * alloc.sharePct) / 100;
      return {
        marketKey: alloc.marketKey,
        sharePct: alloc.sharePct,
        amountUsd,
      };
    });
  };

  const mutation = useMutation({
    mutationFn: async (payload: {
      vaultAddress: string;
      allocations: Array<{ marketKey: string; sharePct: number }>;
    }) => {
      if (!walletAddress) {
        throw new Error('Wallet address is required. Please connect your wallet.');
      }

      if (!isConnected) {
        throw new Error('Wallet is not connected. Please connect your wallet and try again.');
      }

      // Check if we're on the correct chain
      if (chainId !== base.id) {
        try {
          await switchChain({ chainId: base.id });
          // Wait a bit for chain switch
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (switchError: unknown) {
          const err = switchError as { shortMessage?: string; message?: string };
          const errorMsg = err.shortMessage || err.message || 'Failed to switch chain';
          throw new Error(`Please switch to Base network in your wallet: ${errorMsg}`);
        }
      }

      const vaultAddress = payload.vaultAddress as Address;
      const calculatedAllocations = calculateAllocationAmounts(
        payload.allocations,
        selectedAllocation?.totalSupplyUsd ?? 0
      );

      // Store intent first (for record keeping)
      try {
        await fetch('/api/allocations/intents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vaultAddress: payload.vaultAddress,
            allocations: payload.allocations,
            walletAddress,
            notes: `Reallocation: ${payload.allocations.length} markets adjusted`,
          }),
        });
      } catch (error) {
        // Intent storage failure is not critical, continue with transaction
        console.warn('Failed to store intent:', error);
      }

      // Map market uniqueKeys to actual market contract addresses
      const marketAddresses: Address[] = [];
      const amounts: bigint[] = [];
      
      // Get vault asset decimals for amount conversion
      const vaultConfig = vaults.find(v => v.address.toLowerCase() === payload.vaultAddress.toLowerCase());
      if (!vaultConfig) {
        throw new Error('Vault configuration not found');
      }

      // Resolve market addresses from uniqueKeys using the markets data
      // We need to fetch markets data if not already loaded
      if (!markets.data) {
        throw new Error('Markets data not loaded. Please wait and try again.');
      }

      for (const alloc of calculatedAllocations) {
        const market = markets.data.markets.find(m => m.uniqueKey === alloc.marketKey);
        
        if (!market) {
          throw new Error(
            `Market not found for uniqueKey: ${alloc.marketKey}. ` +
            'Please ensure the market is allocated and exists in the markets data.'
          );
        }

        if (!market.id) {
          throw new Error(
            `Market address not found for ${alloc.marketKey}. ` +
            'The market exists but does not have a contract address. ' +
            'Please ensure the market is properly configured and has an address.'
          );
        }

        // Validate that market.id is a valid address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(market.id)) {
          throw new Error(
            `Invalid market address format for ${alloc.marketKey}: ${market.id}. ` +
            'Expected a valid Ethereum address.'
          );
        }

        // Get the vault's asset to determine decimals
        // For Morpho Blue vaults, allocations are typically in the loan asset
        const tokenDecimals = market.loanAsset?.decimals ?? 18;
        const amountUsd = alloc.amountUsd;
        
        // Convert USD amount to token amount
        // For stablecoins like USDC: 1 USD = 1e6 (6 decimals)
        // For other tokens, we assume 1 USD = 1 token unit at the token's decimal precision
        // Note: For accurate conversion, you may need to use price oracles
        // This is a simplified conversion - adjust based on your needs
        const amountInTokens = BigInt(Math.floor(amountUsd * Math.pow(10, tokenDecimals)));
        
        marketAddresses.push(market.id as Address);
        amounts.push(amountInTokens);
      }
      
      if (marketAddresses.length === 0) {
        throw new Error('No valid market addresses found for reallocation');
      }

      if (marketAddresses.length !== amounts.length) {
        throw new Error(`Mismatch: ${marketAddresses.length} market addresses but ${amounts.length} amounts`);
      }

      // Prepare transaction parameters
      const txParams = {
        address: vaultAddress,
        abi: MORPHO_BLUE_VAULT_ALLOCATOR_ABI,
        args: [marketAddresses, amounts] as const,
        chainId: base.id,
      };

      try {
        // Try reallocate function first
        console.log('Attempting reallocate transaction:', {
          vaultAddress,
          marketAddresses,
          amounts: amounts.map(a => a.toString()),
        });

        const hash = await writeContractAsync({
          ...txParams,
          functionName: 'reallocate',
        });

        console.log('Transaction submitted:', hash);
        return { hash, allocations: calculatedAllocations };
      } catch (error: unknown) {
        const err = error as { shortMessage?: string; message?: string; cause?: unknown };
        const errorMessage = err.shortMessage || err.message || 'Transaction failed';
        
        console.error('Reallocate transaction failed:', error);
        
        // If reallocate doesn't exist, try updateAllocations
        if (
          errorMessage.includes('function') || 
          errorMessage.includes('not found') || 
          errorMessage.includes('reallocate') ||
          errorMessage.includes('does not exist')
        ) {
          try {
            console.log('Trying updateAllocations as fallback...');
            const hash = await writeContractAsync({
              ...txParams,
              functionName: 'updateAllocations',
            });
            console.log('UpdateAllocations transaction submitted:', hash);
            return { hash, allocations: calculatedAllocations };
          } catch (fallbackError: unknown) {
            const fallbackErr = fallbackError as { shortMessage?: string; message?: string };
            console.error('UpdateAllocations also failed:', fallbackError);
            throw new Error(
              fallbackErr.shortMessage || fallbackErr.message || 
              'Failed to execute reallocation transaction. ' +
              'The vault contract may use a different function name. ' +
              'Please check the vault contract ABI and update MORPHO_BLUE_VAULT_ALLOCATOR_ABI.'
            );
          }
        }
        
        // Re-throw user-friendly errors (like user rejection)
        if (errorMessage.includes('User rejected') || errorMessage.includes('user rejected') || errorMessage.includes('denied')) {
          throw new Error('Transaction was rejected. Please approve the transaction in your wallet to continue.');
        }
        
        throw new Error(errorMessage);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['allocation-intents'] });
      queryClient.invalidateQueries({ queryKey: ['markets-supplied'] });
      if (data.hash) {
        setFeedback({ 
          type: 'success', 
          message: `Transaction submitted! Hash: ${data.hash.slice(0, 10)}...` 
        });
      } else {
        setFeedback({ type: 'success', message: 'Reallocation submitted successfully' });
      }
      // Don't clear edits until transaction is confirmed
    },
    onError: (error: Error) => {
      setFeedback({ type: 'error', message: error.message });
      setTimeout(() => setFeedback(null), 5000);
    },
  });

  // Handle transaction confirmation
  useEffect(() => {
    if (isTxSuccess && txHash) {
      setFeedback({ 
        type: 'success', 
        message: `Transaction confirmed! View on Basescan: https://basescan.org/tx/${txHash}` 
      });
      setEdits(new Map());
      setTimeout(() => setFeedback(null), 10000);
    }
  }, [isTxSuccess, txHash]);

  const handleReallocate = () => {
    if (!selectedAllocation || !hasChanges || shareError) return;
    if (!walletAddress) {
      setFeedback({ type: 'error', message: 'Wallet address is required. Please ensure your wallet is connected.' });
      setTimeout(() => setFeedback(null), 5000);
      return;
    }

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
                              disabled={!hasChanges || shareError || mutation.isPending || isTxPending || isTxConfirming}
                              size="lg"
                            >
                              {isTxPending || isTxConfirming
                                ? isTxConfirming
                                  ? 'Confirming...'
                                  : 'Waiting for wallet...'
                                : mutation.isPending
                                ? 'Preparing transaction...'
                                : 'Reallocate'}
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
