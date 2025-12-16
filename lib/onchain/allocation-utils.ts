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
 * MarketAllocation struct for reallocate function
 */
export interface MarketAllocation {
  market: Address;
  assets: bigint;
}

/**
 * Prepare allocations array for reallocate function
 * Converts uniqueKey strings to addresses and amounts to bigint
 */
export function prepareAllocations(
  allocations: Array<{
    uniqueKey: string;
    assets: string | number | bigint;
  }>
): MarketAllocation[] {
  return allocations.map((alloc) => ({
    market: uniqueKeyToAddress(alloc.uniqueKey),
    assets: typeof alloc.assets === 'bigint' 
      ? alloc.assets 
      : BigInt(alloc.assets.toString()),
  }));
}

/**
 * Calculate allocation changes needed to reach target allocations
 * Returns allocations array with net changes (positive = supply, negative = withdraw)
 */
export function calculateAllocationChanges(
  currentAllocations: Array<{
    uniqueKey: string;
    supplyAssets: bigint;
  }>,
  targetAllocations: Array<{
    uniqueKey: string;
    targetAssets: bigint;
  }>
): MarketAllocation[] {
  // Create maps for easy lookup
  const currentMap = new Map<string, bigint>();
  currentAllocations.forEach((alloc) => {
    currentMap.set(alloc.uniqueKey, alloc.supplyAssets);
  });

  const targetMap = new Map<string, bigint>();
  targetAllocations.forEach((alloc) => {
    targetMap.set(alloc.uniqueKey, alloc.targetAssets);
  });

  // Calculate net changes
  const changes: MarketAllocation[] = [];
  const allMarkets = new Set([...currentMap.keys(), ...targetMap.keys()]);

  for (const uniqueKey of allMarkets) {
    const current = currentMap.get(uniqueKey) ?? BigInt(0);
    const target = targetMap.get(uniqueKey) ?? BigInt(0);
    const change = target - current;

    // Only include markets with non-zero changes
    if (change !== BigInt(0)) {
      changes.push({
        market: uniqueKeyToAddress(uniqueKey),
        assets: change > BigInt(0) ? change : -change, // Always positive, contract handles direction
      });
    }
  }

  // Sort by market address for consistency
  return changes.sort((a, b) => {
    if (a.market < b.market) return -1;
    if (a.market > b.market) return 1;
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
  // Calculate total allocation
  const total = allocations.reduce((sum, alloc) => sum + alloc.assets, BigInt(0));

  // For reallocate, we need withdrawals to match supplies
  // The contract will handle this, but we can validate that we're not over-allocating
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

