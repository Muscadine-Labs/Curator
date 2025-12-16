#!/usr/bin/env tsx
/**
 * Script to rebalance a Morpho V1 vault based on target allocations
 * 
 * This script calculates the net changes needed to reach target allocations
 * and executes a reallocate transaction.
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
 */

import { createWalletClient, createPublicClient, http, getAddress, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { VAULT_ABI } from '../lib/onchain/client';
import { 
  calculateAllocationChanges 
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
  uniqueKey: string;
  supplyAssets: bigint;
}>> {
  // This would typically come from GraphQL API
  // For now, we'll need to fetch from the API endpoint
  const response = await fetch(`http://localhost:3000/api/vaults/${vaultAddress}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch vault data: ${response.statusText}`);
  }
  
  const vault = await response.json();
  
  if (!vault.allocation) {
    return [];
  }

  return vault.allocation.map((alloc: { marketKey: string; supplyAssets?: string | number | null }) => ({
    uniqueKey: alloc.marketKey,
    supplyAssets: alloc.supplyAssets 
      ? BigInt(Math.floor(parseFloat(alloc.supplyAssets.toString()) * 1e18))
      : BigInt(0),
  }));
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

  // Calculate target allocations
  const targetAllocations = config.targets.map((target) => ({
    uniqueKey: target.uniqueKey,
    targetAssets: (totalAssets * BigInt(Math.floor(target.targetPercent * 1e18))) / BigInt(1e20),
  }));

  console.log('\nTarget allocations:');
  targetAllocations.forEach((target) => {
    const percent = (Number(target.targetAssets) / Number(totalAssets)) * 100;
    console.log(`  ${target.uniqueKey}: ${percent.toFixed(2)}% (${target.targetAssets.toString()})`);
  });

  // Calculate changes
  console.log('\nCalculating allocation changes...');
  const changes = calculateAllocationChanges(
    currentAllocations,
    targetAllocations
  );

  if (changes.length === 0) {
    console.log('✅ No changes needed - vault is already at target allocations');
    return;
  }

  console.log('\nAllocation changes:');
  changes.forEach((change, i) => {
    const direction = change.assets > BigInt(0) ? '→ Supply' : '← Withdraw';
    console.log(`  ${i + 1}. ${change.market}: ${direction} ${change.assets.toString()}`);
  });

  // We need to map back to uniqueKey - for now, we'll use the market address directly
  // In practice, you'd maintain a mapping
  const finalAllocations = changes.map(change => ({
    market: change.market,
    assets: change.assets,
  }));

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
      args: [finalAllocations as Array<{ market: Address; assets: bigint }>],
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

