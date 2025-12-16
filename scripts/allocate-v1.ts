#!/usr/bin/env tsx
/**
 * Script to allocate/deallocate funds for Morpho V1 vaults
 * 
 * Usage:
 *   tsx scripts/allocate-v1.ts <vault-address> <market-unique-key> <amount>
 *   tsx scripts/allocate-v1.ts <vault-address> --file allocations.json
 * 
 * Example:
 *   tsx scripts/allocate-v1.ts 0x123... 0xabc... 1000
 *   tsx scripts/allocate-v1.ts 0x123... --file ./allocations.json
 */

import { createWalletClient, createPublicClient, http, getAddress, Address, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { VAULT_ABI } from '../lib/onchain/client';
import { prepareAllocations } from '../lib/onchain/allocation-utils';

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

interface AllocationConfig {
  uniqueKey: string;
  amount: string; // Amount in human-readable format (e.g., "1000.5")
  decimals?: number; // Default 18
}

interface AllocationFile {
  vaultAddress: string;
  allocations: AllocationConfig[];
  decimals?: number; // Default decimals for all allocations
}

async function allocateFromFile(
  vaultAddress: Address,
  filePath: string
): Promise<void> {
  const fs = await import('fs/promises');
  const fileContent = await fs.readFile(filePath, 'utf-8');
  const config: AllocationFile = JSON.parse(fileContent);

  if (getAddress(config.vaultAddress) !== getAddress(vaultAddress)) {
    throw new Error(`Vault address in file (${config.vaultAddress}) doesn't match provided address (${vaultAddress})`);
  }

  const decimals = config.decimals ?? 18;
  const allocations = config.allocations.map((alloc) => ({
    uniqueKey: alloc.uniqueKey,
    assets: parseUnits(alloc.amount, alloc.decimals ?? decimals),
  }));

  await executeAllocation(vaultAddress, allocations);
}

async function allocateSingle(
  vaultAddress: Address,
  marketUniqueKey: string,
  amount: string,
  decimals: number = 18
): Promise<void> {
  const allocations = [{
    uniqueKey: marketUniqueKey,
    assets: parseUnits(amount, decimals),
  }];

  await executeAllocation(vaultAddress, allocations);
}

async function executeAllocation(
  vaultAddress: Address,
  allocations: Array<{ uniqueKey: string; assets: bigint }>
): Promise<void> {
  const account = privateKeyToAccount(getPrivateKey());
  const rpcUrl = getRpcUrl();

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });

  // Prepare allocations for contract
  const contractAllocations = prepareAllocations(allocations);

  console.log('Prepared allocations:');
  contractAllocations.forEach((alloc, i) => {
    console.log(`  ${i + 1}. Market: ${alloc.market}, Amount: ${alloc.assets.toString()}`);
  });

  // Validate allocations
  // Note: We'd need to fetch current total assets for proper validation
  // For now, we'll just check basic structure
  if (contractAllocations.length === 0) {
    throw new Error('No allocations provided');
  }

  console.log(`\nExecuting reallocate on vault ${vaultAddress}...`);

  try {
    const hash = await walletClient.writeContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'reallocate',
      args: [contractAllocations as Array<{ market: Address; assets: bigint }>],
    });

    console.log(`\n✅ Transaction submitted: ${hash}`);
    console.log(`View on BaseScan: https://basescan.org/tx/${hash}`);

    // Wait for confirmation
    console.log('\nWaiting for confirmation...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status === 'success') {
      console.log('✅ Transaction confirmed!');
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

  if (args.length < 2) {
    console.error(`
Usage:
  tsx scripts/allocate-v1.ts <vault-address> <market-unique-key> <amount> [decimals]
  tsx scripts/allocate-v1.ts <vault-address> --file <path-to-json>

Examples:
  tsx scripts/allocate-v1.ts 0x123... 0xabc... 1000
  tsx scripts/allocate-v1.ts 0x123... --file ./allocations.json

Allocation file format:
{
  "vaultAddress": "0x...",
  "decimals": 18,
  "allocations": [
    {
      "uniqueKey": "0x...",
      "amount": "1000.5",
      "decimals": 18
    }
  ]
}
    `);
    process.exit(1);
  }

  const vaultAddress = getAddress(args[0]);

  if (args[1] === '--file') {
    if (args.length < 3) {
      console.error('Error: --file requires a file path');
      process.exit(1);
    }
    await allocateFromFile(vaultAddress, args[2]);
  } else {
    if (args.length < 3) {
      console.error('Error: Missing market unique key or amount');
      process.exit(1);
    }
    const marketUniqueKey = args[1];
    const amount = args[2];
    const decimals = args[3] ? parseInt(args[3], 10) : 18;
    await allocateSingle(vaultAddress, marketUniqueKey, amount, decimals);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

