'use client';

import { useState, useMemo } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useVault } from '@/lib/hooks/useProtocolStats';
import { vaultWriteConfigs } from '@/lib/onchain/vault-writes';
import { 
  uniqueKeyToAddress,
  formatAllocationAmount,
  validateAllocations,
  type MarketAllocation 
} from '@/lib/onchain/allocation-utils';
import { formatCompactUSD } from '@/lib/format/number';
import { cn } from '@/lib/utils';
import { Address } from 'viem';
import { Save, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface AllocationV1Props {
  vaultAddress: string;
}

interface MarketAllocationInput {
  uniqueKey: string;
  marketName: string;
  loanAssetSymbol?: string | null;
  collateralAssetSymbol?: string | null;
  lltv?: number | null;
  currentAssets: bigint;
  currentAssetsUsd: number;
  targetAssets: string; // User input as string
  isIdle: boolean;
  decimals: number;
}

export function AllocationV1({ vaultAddress }: AllocationV1Props) {
  const { address: connectedAddress } = useAccount();
  const { data: vault, isLoading, error } = useVault(vaultAddress);
  const [isEditing, setIsEditing] = useState(false);
  const [allocations, setAllocations] = useState<Map<string, MarketAllocationInput>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Initialize allocations from vault data
  useMemo(() => {
    if (!vault?.allocation || allocations.size > 0) return;

    const initialAllocations = new Map<string, MarketAllocationInput>();
    // Get decimals from vault asset (default to 18 if not available)
    const decimals = vault?.assetDecimals ?? 18;
    
    vault.allocation.forEach((alloc) => {
      if (!alloc.marketKey) return;
      
      // supplyAssets comes as a string from GraphQL (raw wei amount)
      // If it's a number, it might be in USD or wei - we'll treat it as wei
      let supplyAssets: bigint;
      if (typeof alloc.supplyAssets === 'string') {
        try {
          supplyAssets = BigInt(alloc.supplyAssets);
        } catch {
          supplyAssets = BigInt(0);
        }
      } else if (typeof alloc.supplyAssets === 'number') {
        // If it's a number, assume it's already in wei (or convert if needed)
        supplyAssets = BigInt(Math.floor(alloc.supplyAssets));
      } else {
        supplyAssets = BigInt(0);
      }
      
      // Format market identifier using symbols (like MarketRiskV1)
      const formatMarketIdentifier = (
        loanSymbol: string | null | undefined,
        collateralSymbol: string | null | undefined
      ): string => {
        if (collateralSymbol && loanSymbol) {
          return `${collateralSymbol}/${loanSymbol}`;
        }
        if (loanSymbol) {
          return loanSymbol;
        }
        if (collateralSymbol) {
          return collateralSymbol;
        }
        return 'Unknown Market';
      };

      initialAllocations.set(alloc.marketKey, {
        uniqueKey: alloc.marketKey,
        marketName: formatMarketIdentifier(alloc.loanAssetSymbol, alloc.collateralAssetSymbol),
        loanAssetSymbol: alloc.loanAssetSymbol ?? null,
        collateralAssetSymbol: alloc.collateralAssetSymbol ?? null,
        lltv: alloc.lltv ?? null,
        currentAssets: supplyAssets,
        currentAssetsUsd: alloc.supplyAssetsUsd ?? 0,
        targetAssets: formatAllocationAmount(supplyAssets, decimals),
        isIdle: false, // TODO: detect idle market
        decimals,
      });
    });

    setAllocations(initialAllocations);
  }, [vault, allocations.size]);

  const totalAssets = vault?.allocation?.reduce((sum, alloc) => {
    return sum + (alloc.supplyAssetsUsd ?? 0);
  }, 0) ?? 0;

  // Get decimals from vault asset (default to 18 if not available)
  const decimals = vault?.assetDecimals ?? 18;

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setHasChanges(false);
    // Reset to original values
    if (vault?.allocation) {
      const resetAllocations = new Map<string, MarketAllocationInput>();
      vault.allocation.forEach((alloc) => {
        if (!alloc.marketKey) return;
        const existing = allocations.get(alloc.marketKey);
        if (existing) {
          resetAllocations.set(alloc.marketKey, {
            ...existing,
            targetAssets: formatAllocationAmount(existing.currentAssets, existing.decimals),
          });
        }
      });
      setAllocations(resetAllocations);
    }
  };

  const handleAllocationChange = (uniqueKey: string, value: string) => {
    const alloc = allocations.get(uniqueKey);
    if (!alloc) return;

    const updated = new Map(allocations);
    updated.set(uniqueKey, {
      ...alloc,
      targetAssets: value,
    });
    setAllocations(updated);

    // Check if there are changes
    const hasAnyChanges = Array.from(updated.values()).some(
      (a) => a.targetAssets !== formatAllocationAmount(a.currentAssets, a.decimals)
    );
    setHasChanges(hasAnyChanges);
  };

  const handleSave = async () => {
    if (!vault || !connectedAddress) return;

    try {
      // Convert allocations to contract format
      const contractAllocations: MarketAllocation[] = [];
      // Get decimals from vault asset (default to 18 if not available)
      const decimals = vault?.assetDecimals ?? 18;
      
      for (const alloc of allocations.values()) {
        // Parse user input to bigint
        const targetValue = parseFloat(alloc.targetAssets) || 0;
        const targetAssets = BigInt(Math.floor(targetValue * 10 ** decimals));
        const currentAssets = alloc.currentAssets;
        
        // Only include if there's a change
        if (targetAssets !== currentAssets) {
          contractAllocations.push({
            market: uniqueKeyToAddress(alloc.uniqueKey),
            assets: targetAssets,
          });
        }
      }

      if (contractAllocations.length === 0) {
        alert('No changes to save');
        return;
      }

      // Validate allocations
      // Convert totalAssets (USD) to asset units using the correct decimals
      // We need to estimate: if totalAssets USD = X, and 1 asset = ~$1, then totalAssets in asset units ≈ totalAssets
      // But we need to convert to bigint with correct decimals
      // For now, we'll use a reasonable approximation: totalAssets * 10^decimals
      // This assumes 1 asset unit ≈ $1, which is true for stablecoins
      const totalAssetsBigInt = BigInt(Math.floor(totalAssets * 10 ** decimals));
      const validation = validateAllocations(contractAllocations, totalAssetsBigInt);
      
      if (!validation.valid) {
        alert(`Validation failed: ${validation.error}`);
        return;
      }

      // Execute transaction
      writeContract(vaultWriteConfigs.reallocate({
        vaultAddress: vaultAddress as Address,
        allocations: contractAllocations,
      }));
    } catch (error) {
      console.error('Failed to save allocations:', error);
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const calculateTotalAllocation = () => {
    let total = 0;
    allocations.forEach((alloc) => {
      const value = parseFloat(alloc.targetAssets) || 0;
      total += value;
    });
    return total;
  };

  // Calculate total vault assets in asset units (not USD)
  // Sum all current allocations in asset units
  const totalVaultAssetsInUnits = Array.from(allocations.values()).reduce((sum, alloc) => {
    return sum + (Number(alloc.currentAssets) / 10 ** decimals);
  }, 0);

  const allocationPercentage = totalVaultAssetsInUnits > 0 
    ? (calculateTotalAllocation() / totalVaultAssetsInUnits) * 100 
    : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Allocation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load allocation data: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!vault || !vault.allocation || vault.allocation.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-slate-500 dark:text-slate-400">
            No allocation data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const sortedAllocations = Array.from(allocations.values()).sort((a, b) => {
    // Sort by current allocation (descending)
    return Number(b.currentAssets) - Number(a.currentAssets);
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Allocation</CardTitle>
            <CardDescription>
              Manage vault allocations across markets
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button onClick={handleEdit} variant="outline" size="sm">
                Reallocate
              </Button>
            ) : (
              <>
                <Button onClick={handleCancel} variant="outline" size="sm">
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave} 
                  size="sm"
                  disabled={!hasChanges || isPending || isConfirming || !connectedAddress}
                >
                  {isPending || isConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isConfirming ? 'Confirming...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connectedAddress && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Connect your wallet to manage allocations
            </p>
          </div>
        )}

        {isSuccess && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200">
              Allocation updated successfully!
            </p>
          </div>
        )}

        {writeError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-800 dark:text-red-200">
              Transaction failed: {writeError.message}
            </p>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
          <div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total Allocated</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {formatCompactUSD(totalAssets)}
            </p>
          </div>
          {isEditing && (
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">New Allocation</p>
              <p className={cn(
                "text-lg font-semibold",
                Math.abs(allocationPercentage - 100) > 0.01 
                  ? "text-amber-600 dark:text-amber-400" 
                  : "text-slate-900 dark:text-slate-100"
              )}>
                {allocationPercentage.toFixed(2)}%
              </p>
            </div>
          )}
        </div>

        {/* Allocation Table */}
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-4 p-2 text-xs font-medium text-slate-600 dark:text-slate-400 border-b">
            <div className="col-span-4">Market</div>
            <div className={isEditing ? "col-span-3 text-right" : "col-span-8 text-right"}>Current</div>
            {isEditing && <div className="col-span-3 text-right">New Allocation</div>}
            {isEditing && <div className="col-span-2 text-right">%</div>}
          </div>

          {sortedAllocations.map((alloc) => {
            const currentPercent = totalAssets > 0 
              ? (alloc.currentAssetsUsd / totalAssets) * 100 
              : 0;
            const newValue = parseFloat(alloc.targetAssets) || 0;
            // Calculate new percentage based on total vault assets in asset units
            const newPercent = totalVaultAssetsInUnits > 0 
              ? (newValue / totalVaultAssetsInUnits) * 100 
              : 0;

            return (
              <div
                key={alloc.uniqueKey}
                className={cn(
                  "grid grid-cols-12 gap-4 p-3 rounded-lg border",
                  alloc.isIdle 
                    ? "bg-slate-100/50 dark:bg-slate-800/50 opacity-75" 
                    : "bg-white dark:bg-slate-900"
                )}
              >
                <div className="col-span-4">
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://app.morpho.org/base/market/${alloc.uniqueKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors underline decoration-1 underline-offset-2"
                    >
                      {alloc.marketName}
                    </a>
                    {alloc.lltv !== null && alloc.lltv !== undefined && (
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        LTV: {(Number(alloc.lltv) / 1e16).toFixed(2)}%
                      </span>
                    )}
                    {alloc.isIdle && (
                      <Badge variant="outline" className="text-xs">
                        Idle
                      </Badge>
                    )}
                  </div>
                </div>
                <div className={isEditing ? "col-span-3 text-right" : "col-span-8 text-right"}>
                  <p className="text-sm font-medium">
                    {formatAllocationAmount(alloc.currentAssets, alloc.decimals)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatCompactUSD(alloc.currentAssetsUsd)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {currentPercent.toFixed(2)}%
                  </p>
                </div>
                {isEditing && (
                  <>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        step={alloc.decimals === 6 ? "0.000001" : alloc.decimals === 18 ? "0.000000000000000001" : "0.000001"}
                        value={alloc.targetAssets}
                        onChange={(e) => handleAllocationChange(alloc.uniqueKey, e.target.value)}
                        className="text-right"
                        placeholder="0.0"
                      />
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-sm font-medium">
                        {newPercent.toFixed(2)}%
                      </p>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {isEditing && Math.abs(allocationPercentage - 100) > 0.01 && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Total allocation is {allocationPercentage.toFixed(2)}%. Consider allocating remaining funds to the Idle Market.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

