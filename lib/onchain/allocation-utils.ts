import { Address, getAddress } from 'viem';

/**
 * MarketParams struct as defined in Morpho Blue
 * Matches the struct used in the reallocate function
 */
export interface MarketParams {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
}

/**
 * MarketAllocation struct for reallocate function
 * Matches Morpho documentation: https://docs.morpho.org/get-started/resources/contracts/morpho-vaults
 */
export interface MarketAllocation {
  marketParams: MarketParams;
  assets: bigint;
}

/**
 * Maximum uint256 value (type(uint256).max)
 * Used for the last allocation to capture all remaining funds (dust)
 */
export const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

/**
 * Prepare allocations array for reallocate function
 * Converts market data to MarketParams struct and amounts to bigint
 * 
 * Note: The last allocation should use MAX_UINT256 for assets to ensure
 * all remaining withdrawn liquidity is supplied (prevents dust).
 * See Morpho docs: https://docs.morpho.org/get-started/resources/contracts/morpho-vaults
 */
export function prepareAllocations(
  allocations: Array<{
    loanAssetAddress: string;
    collateralAssetAddress: string;
    oracleAddress: string;
    irmAddress: string;
    lltv: string | number | bigint;
    assets: string | number | bigint;
  }>,
  useMaxForLast: boolean = false
): MarketAllocation[] {
  const result = allocations.map((alloc, index) => {
    const isLast = index === allocations.length - 1;
    const assets = useMaxForLast && isLast
      ? MAX_UINT256
      : (typeof alloc.assets === 'bigint' 
          ? alloc.assets 
          : BigInt(alloc.assets.toString()));
    
    return {
      marketParams: {
        loanToken: getAddress(alloc.loanAssetAddress),
        collateralToken: getAddress(alloc.collateralAssetAddress),
        oracle: getAddress(alloc.oracleAddress),
        irm: getAddress(alloc.irmAddress),
        lltv: typeof alloc.lltv === 'bigint' 
          ? alloc.lltv 
          : BigInt(alloc.lltv.toString()),
      },
      assets,
    };
  });
  
  return result;
}

/**
 * Build reallocate targets from current and target allocations
 * 
 * reallocate expects FINAL TARGET balances, not deltas.
 * MarketAllocation.assets must represent the desired final supply per market.
 * 
 * @param currentAllocations - Current market allocations with supplyAssets
 * @param targetAllocations - Target market allocations with targetAssets (final desired amounts)
 * @returns MarketAllocation[] with final target assets per market
 * 
 * Note: The last allocation should use MAX_UINT256 to capture all remaining funds (dust).
 * This ensures totalWithdrawn = totalSupplied and prevents dust reverts.
 */
export function buildReallocateTargets(
  currentAllocations: Array<{
    marketId?: string; // bytes32 hex string (optional, for reference)
    supplyAssets: bigint;
    marketParams: MarketParams;
  }>,
  targetAllocations: Array<{
    marketId?: string; // bytes32 hex string (optional, for reference)
    targetAssets: bigint; // Final desired supply amount (not delta)
    marketParams: MarketParams;
  }>
): MarketAllocation[] {
  // Create maps for easy lookup by marketParams (markets are identified by MarketParams struct)
  // We'll use a string key based on marketParams to identify markets
  const marketKey = (params: MarketParams): string => {
    return `${params.loanToken.toLowerCase()}-${params.collateralToken.toLowerCase()}-${params.oracle.toLowerCase()}-${params.irm.toLowerCase()}-${params.lltv.toString()}`;
  };

  const currentMap = new Map<string, { assets: bigint; marketParams: MarketParams }>();
  currentAllocations.forEach((alloc) => {
    const key = marketKey(alloc.marketParams);
    currentMap.set(key, { assets: alloc.supplyAssets, marketParams: alloc.marketParams });
  });

  const targetMap = new Map<string, { assets: bigint; marketParams: MarketParams }>();
  targetAllocations.forEach((alloc) => {
    const key = marketKey(alloc.marketParams);
    targetMap.set(key, { assets: alloc.targetAssets, marketParams: alloc.marketParams });
  });

  // Build final target allocations (not deltas)
  // Include all markets that have a target, or are currently allocated
  const targets: MarketAllocation[] = [];
  const allMarketKeys = new Set([...currentMap.keys(), ...targetMap.keys()]);

  for (const key of allMarketKeys) {
    const target = targetMap.get(key);
    const current = currentMap.get(key);
    
    // Use target if specified, otherwise use current (keep existing allocation)
    // If neither exists, skip (shouldn't happen, but defensive)
    const finalAssets = target?.assets ?? current?.assets;
    const marketParams = target?.marketParams ?? current?.marketParams;
    
    if (!marketParams) {
      throw new Error(`Missing marketParams for market key ${key}`);
    }

    // Include all markets with non-zero final allocation
    // Zero allocations will be handled by the contract (withdraws all)
    if (finalAssets !== undefined && finalAssets > BigInt(0)) {
      targets.push({
        marketParams,
        assets: finalAssets, // Final target amount, not delta
      });
    }
  }

  // Sort by market params for consistency (deterministic ordering)
  const sorted = targets.sort((a, b) => {
    const aKey = marketKey(a.marketParams);
    const bKey = marketKey(b.marketParams);
    if (aKey < bKey) return -1;
    if (aKey > bKey) return 1;
    return 0;
  });

  // Ensure the last allocation uses MAX_UINT256 for dust handling
  // This is required by Morpho Vaults V1 to ensure totalWithdrawn = totalSupplied
  if (sorted.length > 0) {
    sorted[sorted.length - 1].assets = MAX_UINT256;
  }

  return sorted;
}

/**
 * Validate that allocations sum correctly
 * For reallocate, we need to ensure withdrawals match supplies
 */
export function validateAllocations(
  allocations: MarketAllocation[],
  currentTotal: bigint
): { valid: boolean; error?: string } {
  // Validate that all MarketParams are present
  for (const alloc of allocations) {
    if (!alloc.marketParams) {
      return {
        valid: false,
        error: 'Missing marketParams in allocation',
      };
    }
    // Validate all required fields
    if (!alloc.marketParams.loanToken || !alloc.marketParams.collateralToken ||
        !alloc.marketParams.oracle || !alloc.marketParams.irm) {
      return {
        valid: false,
        error: 'Missing required fields in marketParams',
      };
    }
  }

  // Calculate total allocation
  // Exclude allocations with MAX_UINT256 from the sum (special case for dust handling)
  // The last allocation typically uses MAX_UINT256 to capture all remaining funds
  const allocationsToSum = allocations.filter(alloc => alloc.assets !== MAX_UINT256);
  const total = allocationsToSum.reduce((sum, alloc) => sum + alloc.assets, BigInt(0));

  // For reallocate, we need withdrawals to match supplies
  // The contract will handle this, but we can validate that we're not over-allocating
  // When MAX_UINT256 is used, we only validate the sum of non-MAX allocations
  if (total > currentTotal * BigInt(2)) {
    return {
      valid: false,
      error: `Total allocation (${total.toString()}) exceeds reasonable limits`,
    };
  }

  return { valid: true };
}

/**
 * Format allocation amount for display
 */
export function formatAllocationAmount(
  amount: bigint,
  decimals: number = 18,
  symbol?: string
): string {
  // Fix BigInt math: use BigInt(10) ** BigInt(decimals) instead of BigInt(10 ** decimals)
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = amount / divisor;
  const remainder = amount % divisor;
  
  if (remainder === BigInt(0)) {
    return `${whole.toString()}${symbol ? ` ${symbol}` : ''}`;
  }
  
  const decimalsStr = remainder.toString().padStart(decimals, '0');
  const trimmed = decimalsStr.replace(/0+$/, '');
  
  return `${whole.toString()}.${trimmed}${symbol ? ` ${symbol}` : ''}`;
}

