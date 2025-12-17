#!/usr/bin/env tsx
/**
 * Script to rebalance a Morpho V1 vault based on target allocations
 * 
 * This script builds final target allocations (not deltas) and executes a reallocate transaction.
 * The reallocate function expects FINAL TARGET balances per market, not changes.
 * 
 * Usage:
 *   tsx scripts/rebalance-v1.ts <vault-address> --targets targets.json
 * 
 * Example targets.json:
 * {
 *   "vaultAddress": "0x...",
 *   "targets": [
 *     { "uniqueKey": "0x...", "targetPercent": 50 },
 *     { "uniqueKey": "0x...", "targetPercent": 30 },
 *     { "uniqueKey": "0x...", "targetPercent": 20 }
 *   ]
 * }
 * 
 * Note: The last allocation will automatically use MAX_UINT256 to capture all remaining funds (dust).
 */

import { createWalletClient, createPublicClient, http, getAddress, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { VAULT_ABI } from '../lib/onchain/client';
import { 
  buildReallocateTargets,
  type MarketParams
} from '../lib/onchain/allocation-utils';

// Get RPC URL
function getRpcUrl(): string {
  if (process.env.ALCHEMY_API_KEY) {
    return `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  }
  if (process.env.COINBASE_CDP_API_KEY) {
    return `https://base-mainnet.cdp.coinbase.com/v1/${process.env.COINBASE_CDP_API_KEY}`;
  }
  throw new Error('No RPC URL configured. Set ALCHEMY_API_KEY or COINBASE_CDP_API_KEY');
}

// Get private key from environment
function getPrivateKey(): `0x${string}` {
  const key = process.env.PRIVATE_KEY;
  if (!key) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }
  if (!key.startsWith('0x')) {
    return `0x${key}` as `0x${string}`;
  }
  return key as `0x${string}`;
}

interface TargetAllocation {
  uniqueKey: string;
  targetPercent: number; // Percentage of total assets (0-100)
}

interface RebalanceConfig {
  vaultAddress: string;
  targets: TargetAllocation[];
}

async function fetchCurrentAllocations(vaultAddress: Address): Promise<Array<{
  marketId?: string;
  supplyAssets: bigint;
  marketParams: MarketParams;
}>> {
  // Fetch from the API endpoint
  const response = await fetch(`http://localhost:3000/api/vaults/${vaultAddress}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch vault data: ${response.statusText}`);
  }
  
  const vault = await response.json();
  
  if (!vault.allocation) {
    return [];
  }

  interface AllocationData {
    marketKey?: string;
    loanAssetAddress?: string | null;
    collateralAssetAddress?: string | null;
    oracleAddress?: string | null;
    irmAddress?: string | null;
    lltv?: number | string | null;
    supplyAssets?: string | number | null;
  }

  return (vault.allocation as AllocationData[])
    .filter((alloc) => {
      // Only include allocations with complete market params
      return alloc.loanAssetAddress && 
             alloc.collateralAssetAddress && 
             alloc.oracleAddress && 
             alloc.irmAddress && 
             alloc.lltv != null;
    })
    .map((alloc) => {
      // Parse supplyAssets
      let supplyAssets: bigint;
      if (typeof alloc.supplyAssets === 'string') {
        try {
          supplyAssets = BigInt(alloc.supplyAssets);
        } catch {
          supplyAssets = BigInt(0);
        }
      } else if (typeof alloc.supplyAssets === 'number') {
        supplyAssets = BigInt(Math.floor(alloc.supplyAssets));
      } else {
        supplyAssets = BigInt(0);
      }

      // Convert lltv to bigint (handle different formats)
      // Safe: filtered above to ensure lltv is not null
      const lltvValue = typeof alloc.lltv === 'number' ? alloc.lltv : parseFloat(alloc.lltv as string);
      const lltvBigInt = lltvValue > 1 
        ? BigInt(Math.floor(lltvValue * 1e16)) // Percentage (86 -> 860000000000000000)
        : BigInt(Math.floor(lltvValue * 1e18)); // Ratio (0.86 -> 860000000000000000)

      return {
        marketId: alloc.marketKey,
        supplyAssets,
        marketParams: {
          loanToken: getAddress(alloc.loanAssetAddress!), // Safe: filtered above
          collateralToken: getAddress(alloc.collateralAssetAddress!), // Safe: filtered above
          oracle: getAddress(alloc.oracleAddress!), // Safe: filtered above
          irm: getAddress(alloc.irmAddress!), // Safe: filtered above
          lltv: lltvBigInt,
        },
      };
    });
}

async function fetchTotalAssets(vaultAddress: Address, rpcUrl: string): Promise<bigint> {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });
  const totalAssets = await publicClient.readContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'totalAssets',
  });
  return totalAssets as bigint;
}

async function rebalance(
  vaultAddress: Address,
  configPath: string
): Promise<void> {
  const fs = await import('fs/promises');
  const fileContent = await fs.readFile(configPath, 'utf-8');
  const config: RebalanceConfig = JSON.parse(fileContent);

  if (getAddress(config.vaultAddress) !== getAddress(vaultAddress)) {
    throw new Error(`Vault address in file (${config.vaultAddress}) doesn't match provided address (${vaultAddress})`);
  }

  // Validate targets sum to 100%
  const totalPercent = config.targets.reduce((sum, t) => sum + t.targetPercent, 0);
  if (Math.abs(totalPercent - 100) > 0.01) {
    throw new Error(`Target allocations must sum to 100% (got ${totalPercent}%)`);
  }

  const rpcUrl = getRpcUrl();
  
  console.log('Fetching current allocations...');
  const currentAllocations = await fetchCurrentAllocations(vaultAddress);
  const totalAssets = await fetchTotalAssets(vaultAddress, rpcUrl);

  console.log(`Total vault assets: ${totalAssets.toString()}`);
  console.log(`Current allocations: ${currentAllocations.length} markets`);

  // Build target allocations with MarketParams
  // We need to match targets to current allocations to get MarketParams
  const targetAllocations = config.targets
    .map((target) => {
      // Find the current allocation for this market to get MarketParams
      const current = currentAllocations.find(c => c.marketId === target.uniqueKey);
      if (!current) {
        console.warn(`Warning: Market ${target.uniqueKey} not found in current allocations. Skipping.`);
        return null;
      }

      const targetAssets = (totalAssets * BigInt(Math.floor(target.targetPercent * 1e18))) / BigInt(1e20);
      
      return {
        marketId: target.uniqueKey,
        targetAssets, // Final desired amount (not delta)
        marketParams: current.marketParams,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  console.log('\nTarget allocations (final amounts):');
  targetAllocations.forEach((target) => {
    const percent = (Number(target.targetAssets) / Number(totalAssets)) * 100;
    console.log(`  ${target.marketId}: ${percent.toFixed(2)}% (${target.targetAssets.toString()})`);
  });

  // Build final target allocations using buildReallocateTargets
  // This function builds final target allocations (not deltas) and ensures
  // the last allocation uses MAX_UINT256 for dust handling
  console.log('\nBuilding reallocate targets...');
  const finalAllocations = buildReallocateTargets(
    currentAllocations,
    targetAllocations
  );

  if (finalAllocations.length === 0) {
    console.log('✅ No allocations to rebalance');
    return;
  }

  console.log('\nFinal allocations for reallocate:');
  finalAllocations.forEach((alloc, i) => {
    const isLast = i === finalAllocations.length - 1;
    const assetsDisplay = isLast && alloc.assets === BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
      ? 'MAX_UINT256 (all remaining)'
      : alloc.assets.toString();
    console.log(`  ${i + 1}. Market: ${alloc.marketParams.loanToken}/${alloc.marketParams.collateralToken}, Assets: ${assetsDisplay}`);
  });

  const account = privateKeyToAccount(getPrivateKey());

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });

  console.log(`\nExecuting reallocate on vault ${vaultAddress}...`);

  try {
    const hash = await walletClient.writeContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'reallocate',
      args: [finalAllocations as readonly {
        marketParams: {
          loanToken: `0x${string}`;
          collateralToken: `0x${string}`;
          oracle: `0x${string}`;
          irm: `0x${string}`;
          lltv: bigint;
        };
        assets: bigint;
      }[]],
    });

    console.log(`\n✅ Transaction submitted: ${hash}`);
    console.log(`View on BaseScan: https://basescan.org/tx/${hash}`);

    // Wait for confirmation
    console.log('\nWaiting for confirmation...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status === 'success') {
      console.log('✅ Rebalancing completed successfully!');
    } else {
      console.error('❌ Transaction failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Transaction failed:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3 || args[1] !== '--targets') {
    console.error(`
Usage:
  tsx scripts/rebalance-v1.ts <vault-address> --targets <path-to-json>

Example targets.json:
{
  "vaultAddress": "0x...",
  "targets": [
    { "uniqueKey": "0x...", "targetPercent": 50 },
    { "uniqueKey": "0x...", "targetPercent": 30 },
    { "uniqueKey": "0x...", "targetPercent": 20 }
  ]
}

Note: Target percentages must sum to 100%
    `);
    process.exit(1);
  }

  const vaultAddress = getAddress(args[0]);
  const configPath = args[2];

  await rebalance(vaultAddress, configPath);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

