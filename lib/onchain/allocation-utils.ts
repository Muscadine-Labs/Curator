import { Address, getAddress, pad } from 'viem';

/**
 * Convert Morpho Blue market uniqueKey (bytes32 hex string) to address format
 * Morpho Blue markets use uniqueKey (bytes32) but contract calls need address (20 bytes)
 * We take the first 20 bytes of the uniqueKey
 */
export function uniqueKeyToAddress(uniqueKey: string): Address {
  try {
    // Remove 0x prefix if present
    const key = uniqueKey.startsWith('0x') ? uniqueKey.slice(2) : uniqueKey;
    
    // If it's already an address format (40 hex chars), return it
    if (key.length === 40) {
      return getAddress(`0x${key}`);
    }
    
    // If it's a bytes32 (64 hex chars), take first 20 bytes (40 hex chars)
    if (key.length === 64) {
      const addressHex = key.slice(0, 40);
      return getAddress(`0x${addressHex}`);
    }
    
    // If it's shorter, pad it
    const padded = pad(`0x${key}`, { size: 20 });
    return getAddress(padded);
  } catch (error) {
    throw new Error(`Failed to convert uniqueKey to address: ${uniqueKey}`, { cause: error });
  }
}

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
 * Calculate allocation changes needed to reach target allocations
 * Returns allocations array with net changes (positive = supply, negative = withdraw)
 */
export function calculateAllocationChanges(
  currentAllocations: Array<{
    uniqueKey: string;
    supplyAssets: bigint;
    marketParams: MarketParams;
  }>,
  targetAllocations: Array<{
    uniqueKey: string;
    targetAssets: bigint;
    marketParams: MarketParams;
  }>
): MarketAllocation[] {
  // Create maps for easy lookup
  const currentMap = new Map<string, { assets: bigint; marketParams: MarketParams }>();
  currentAllocations.forEach((alloc) => {
    currentMap.set(alloc.uniqueKey, { assets: alloc.supplyAssets, marketParams: alloc.marketParams });
  });

  const targetMap = new Map<string, { assets: bigint; marketParams: MarketParams }>();
  targetAllocations.forEach((alloc) => {
    targetMap.set(alloc.uniqueKey, { assets: alloc.targetAssets, marketParams: alloc.marketParams });
  });

  // Calculate net changes
  const changes: MarketAllocation[] = [];
  const allMarkets = new Set([...currentMap.keys(), ...targetMap.keys()]);

  for (const uniqueKey of allMarkets) {
    const current = currentMap.get(uniqueKey);
    const target = targetMap.get(uniqueKey);
    const currentAssets = current?.assets ?? BigInt(0);
    const targetAssets = target?.assets ?? BigInt(0);
    const change = targetAssets - currentAssets;

    // Only include markets with non-zero changes
    if (change !== BigInt(0)) {
      // Use target marketParams if available, otherwise current
      const marketParams = target?.marketParams ?? current?.marketParams;
      if (!marketParams) {
        throw new Error(`Missing marketParams for market ${uniqueKey}`);
      }
      
      changes.push({
        marketParams,
        assets: change > BigInt(0) ? change : -change, // Always positive, contract handles direction
      });
    }
  }

  // Sort by market address for consistency
  return changes.sort((a, b) => {
    const aAddr = a.marketParams.loanToken;
    const bAddr = b.marketParams.loanToken;
    if (aAddr < bAddr) return -1;
    if (aAddr > bAddr) return 1;
    return 0;
  });
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
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const remainder = amount % divisor;
  
  if (remainder === BigInt(0)) {
    return `${whole.toString()}${symbol ? ` ${symbol}` : ''}`;
  }
  
  const decimalsStr = remainder.toString().padStart(decimals, '0');
  const trimmed = decimalsStr.replace(/0+$/, '');
  
  return `${whole.toString()}.${trimmed}${symbol ? ` ${symbol}` : ''}`;
}

