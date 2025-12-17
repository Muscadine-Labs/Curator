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
  formatAllocationAmount,
  validateAllocations,
  MAX_UINT256,
  type MarketAllocation,
  type MarketParams
} from '@/lib/onchain/allocation-utils';
import { formatCompactUSD } from '@/lib/format/number';
import { cn } from '@/lib/utils';
import { Address, getAddress } from 'viem';
import { Save, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface AllocationV1Props {
  vaultAddress: string;
}

interface MarketAllocationInput {
  uniqueKey: string;
  marketName: string;
  loanAssetAddress?: string | null;
  loanAssetSymbol?: string | null;
  collateralAssetAddress?: string | null;
  collateralAssetSymbol?: string | null;
  oracleAddress?: string | null;
  irmAddress?: string | null;
  lltv?: number | null;
  currentAssets: bigint;
  currentAssetsUsd: number;
  targetAssets: string; // User input as string (can be absolute or percentage)
  targetPercentage: string; // User input as percentage string
  isIdle: boolean;
  decimals: number;
}

export function AllocationV1({ vaultAddress }: AllocationV1Props) {
  const { address: connectedAddress } = useAccount();
  const { data: vault, isLoading, error } = useVault(vaultAddress);
  const [isEditing, setIsEditing] = useState(false);
  const [allocations, setAllocations] = useState<Map<string, MarketAllocationInput>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);
  const [inputMode, setInputMode] = useState<'absolute' | 'percentage'>('absolute');

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Calculate total assets for percentage calculations
  const totalAssets = vault?.allocation?.reduce((sum, alloc) => {
    return sum + (alloc.supplyAssetsUsd ?? 0);
  }, 0) ?? 0;

  // Initialize allocations from vault data
  useMemo(() => {
    if (!vault?.allocation || allocations.size > 0) return;

    const initialAllocations = new Map<string, MarketAllocationInput>();
    // Get decimals from vault asset (default to 18 if not available)
    const decimals = vault?.assetDecimals ?? 18;
    
    // Calculate total for percentage
    const total = vault.allocation.reduce((sum, alloc) => {
      return sum + (alloc.supplyAssetsUsd ?? 0);
    }, 0);
    
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

      const currentPercent = total > 0 
        ? (alloc.supplyAssetsUsd ?? 0) / total * 100
        : 0;
      
      initialAllocations.set(alloc.marketKey, {
        uniqueKey: alloc.marketKey,
        marketName: formatMarketIdentifier(alloc.loanAssetSymbol, alloc.collateralAssetSymbol),
        loanAssetAddress: alloc.loanAssetAddress ?? null,
        loanAssetSymbol: alloc.loanAssetSymbol ?? null,
        collateralAssetAddress: alloc.collateralAssetAddress ?? null,
        collateralAssetSymbol: alloc.collateralAssetSymbol ?? null,
        oracleAddress: alloc.oracleAddress ?? null,
        irmAddress: alloc.irmAddress ?? null,
        lltv: alloc.lltv ?? null,
        currentAssets: supplyAssets,
        currentAssetsUsd: alloc.supplyAssetsUsd ?? 0,
        targetAssets: formatAllocationAmount(supplyAssets, decimals),
        targetPercentage: currentPercent.toFixed(4),
        isIdle: false, // TODO: detect idle market
        decimals,
      });
    });

    setAllocations(initialAllocations);
  }, [vault, allocations.size]);

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
          const currentPercent = totalAssets > 0 
            ? (alloc.supplyAssetsUsd ?? 0) / totalAssets * 100
            : 0;
          resetAllocations.set(alloc.marketKey, {
            ...existing,
            targetAssets: formatAllocationAmount(existing.currentAssets, existing.decimals),
            targetPercentage: currentPercent.toFixed(4),
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
    
    if (inputMode === 'percentage') {
      // Convert percentage to absolute value
      const percentage = parseFloat(value) || 0;
      const totalVaultAssetsInUnits = Array.from(allocations.values()).reduce((sum, a) => {
        return sum + (Number(a.currentAssets) / 10 ** a.decimals);
      }, 0);
      const absoluteValue = (percentage / 100) * totalVaultAssetsInUnits;
      updated.set(uniqueKey, {
        ...alloc,
        targetPercentage: value,
        targetAssets: absoluteValue.toFixed(alloc.decimals === 6 ? 6 : alloc.decimals === 18 ? 18 : 6),
      });
    } else {
      // Convert absolute value to percentage
      const absoluteValue = parseFloat(value) || 0;
      const totalVaultAssetsInUnits = Array.from(allocations.values()).reduce((sum, a) => {
        return sum + (Number(a.currentAssets) / 10 ** a.decimals);
      }, 0);
      const percentage = totalVaultAssetsInUnits > 0 
        ? (absoluteValue / totalVaultAssetsInUnits) * 100 
        : 0;
      updated.set(uniqueKey, {
        ...alloc,
        targetAssets: value,
        targetPercentage: percentage.toFixed(4),
      });
    }
    
    setAllocations(updated);

    // Check if there are changes
    const hasAnyChanges = Array.from(updated.values()).some((a) => {
      const currentAbsolute = formatAllocationAmount(a.currentAssets, a.decimals);
      return a.targetAssets !== currentAbsolute;
    });
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
        
        // Only validate and include markets that have a change
        if (targetAssets !== currentAssets) {
          // Validate required fields for MarketParams (only for markets being changed)
          const missingFields: string[] = [];
          if (!alloc.loanAssetAddress) missingFields.push('loanAssetAddress');
          if (!alloc.collateralAssetAddress) missingFields.push('collateralAssetAddress');
          if (!alloc.oracleAddress) missingFields.push('oracleAddress');
          if (!alloc.irmAddress) missingFields.push('irmAddress');
          if (alloc.lltv === null || alloc.lltv === undefined) missingFields.push('lltv');
          
          if (missingFields.length > 0) {
            console.error(`Missing market parameters for ${alloc.marketName}:`, {
              missingFields,
              allocation: alloc,
            });
            alert(`Missing market parameters for ${alloc.marketName}: ${missingFields.join(', ')}. Cannot reallocate. Please ensure all market data is loaded.`);
            return;
          }

          // At this point, we know all fields are present (validated above)
          // Construct MarketParams struct
          // lltv comes from GraphQL as a number (like 0.86 for 86%), needs to be converted to wei (1e18)
          // If it's already a ratio (0-1), multiply by 1e18; if it's a percentage (0-100), multiply by 1e16
          const lltvValue = alloc.lltv!; // Safe because we validated above
          const lltvBigInt = lltvValue > 1 
            ? BigInt(Math.floor(lltvValue * 1e16)) // Percentage (86 -> 860000000000000000)
            : BigInt(Math.floor(lltvValue * 1e18)); // Ratio (0.86 -> 860000000000000000)
          
          const marketParams: MarketParams = {
            loanToken: getAddress(alloc.loanAssetAddress!), // Safe because we validated above
            collateralToken: getAddress(alloc.collateralAssetAddress!), // Safe because we validated above
            oracle: getAddress(alloc.oracleAddress!), // Safe because we validated above
            irm: getAddress(alloc.irmAddress!), // Safe because we validated above
            lltv: lltvBigInt,
          };

          contractAllocations.push({
            marketParams,
            assets: targetAssets,
          });
        }
      }

      if (contractAllocations.length === 0) {
        alert('No changes to save');
        return;
      }

      // According to Morpho documentation:
      // "Sender is expected to pass assets = type(uint256).max with the last MarketAllocation 
      // of allocations to supply all the remaining withdrawn liquidity, which would ensure 
      // that totalWithdrawn = totalSupplied."
      // This prevents dust from being left behind - all remaining funds go to the last market.
      if (contractAllocations.length > 0) {
        const lastAllocation = contractAllocations[contractAllocations.length - 1];
        // Set the last allocation to max uint256 to capture all remaining funds (dust)
        lastAllocation.assets = MAX_UINT256;
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

  // Sort allocations similar to MarketRiskV1:
  // 1. Sort by current allocation (descending - highest first)
  // 2. If allocation is the same, idle markets go last
  const sortedAllocations = Array.from(allocations.values()).sort((a, b) => {
    const aAssets = Number(a.currentAssets);
    const bAssets = Number(b.currentAssets);
    
    // First, sort by current allocation (descending)
    if (aAssets !== bAssets) {
      return bAssets - aAssets;
    }
    
    // If allocation is the same, put idle markets last
    if (a.isIdle && !b.isIdle) {
      return 1; // a goes after b
    }
    if (!a.isIdle && b.isIdle) {
      return -1; // a goes before b
    }
    
    // Both idle or both not idle - maintain current order
    return 0;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Allocation</CardTitle>
            <CardDescription>
              Manage vault allocations across markets
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isEditing && (
              <div className="flex items-center gap-2 border rounded-lg p-1">
                <button
                  onClick={() => setInputMode('absolute')}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded transition-colors",
                    inputMode === 'absolute'
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  )}
                >
                  Amount
                </button>
                <button
                  onClick={() => setInputMode('percentage')}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded transition-colors",
                    inputMode === 'percentage'
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  )}
                >
                  %
                </button>
              </div>
            )}
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
        <div className="space-y-2 overflow-x-auto">
          <div className="grid grid-cols-12 gap-2 sm:gap-4 p-2 text-xs font-medium text-slate-600 dark:text-slate-400 border-b min-w-[600px]">
            <div className="col-span-4">Market</div>
            <div className={isEditing ? "col-span-3 text-right" : "col-span-8 text-right"}>Current</div>
            {isEditing && <div className="col-span-3 text-right">{inputMode === 'percentage' ? 'New %' : 'New Allocation'}</div>}
            {isEditing && <div className="col-span-2 text-right">{inputMode === 'percentage' ? 'Amount' : '%'}</div>}
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
                  "grid grid-cols-12 gap-2 sm:gap-4 p-3 rounded-lg border min-w-[600px]",
                  alloc.isIdle 
                    ? "bg-slate-100/50 dark:bg-slate-800/50 opacity-75" 
                    : "bg-white dark:bg-slate-900"
                )}
              >
                <div className="col-span-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`https://app.morpho.org/base/market/${alloc.uniqueKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors underline decoration-1 underline-offset-2 break-words"
                    >
                      {alloc.marketName}
                    </a>
                    {alloc.isIdle && (
                      <Badge variant="outline" className="text-xs">
                        Idle
                      </Badge>
                    )}
                  </div>
                  {alloc.lltv !== null && alloc.lltv !== undefined && (
                    <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {/* LTV is stored as wei format (860000000000000000 = 0.86 = 86%), convert to percentage */}
                      LTV: {alloc.lltv > 1e17 
                        ? (Number(alloc.lltv) / 1e16).toFixed(2) // If > 1e17, it's in wei format, divide by 1e16 for percentage
                        : alloc.lltv > 1 
                          ? alloc.lltv.toFixed(2) // Already a percentage
                          : (alloc.lltv * 100).toFixed(2) // Ratio, convert to percentage
                      }%
                    </div>
                  )}
                </div>
                <div className={isEditing ? "col-span-3 text-right" : "col-span-8 text-right"}>
                  <p className="text-xs sm:text-sm font-medium break-words">
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
                        step={inputMode === 'percentage' ? "0.01" : (alloc.decimals === 6 ? "0.000001" : alloc.decimals === 18 ? "0.000000000000000001" : "0.000001")}
                        value={inputMode === 'percentage' ? alloc.targetPercentage : alloc.targetAssets}
                        onChange={(e) => handleAllocationChange(alloc.uniqueKey, e.target.value)}
                        className="text-right"
                        placeholder={inputMode === 'percentage' ? "0.00" : "0.0"}
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-right">
                        {inputMode === 'percentage' 
                          ? formatAllocationAmount(alloc.currentAssets, alloc.decimals)
                          : `${parseFloat(alloc.targetPercentage || '0').toFixed(2)}%`}
                      </p>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-xs sm:text-sm font-medium break-words">
                        {inputMode === 'percentage' 
                          ? formatAllocationAmount(alloc.currentAssets, alloc.decimals)
                          : `${newPercent.toFixed(2)}%`}
                      </p>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {isEditing && Math.abs(allocationPercentage - 100) > 0.01 && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
              Total allocation is {allocationPercentage.toFixed(2)}%. The last market in the allocation will automatically receive all remaining funds (dust) to ensure totalWithdrawn = totalSupplied.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

