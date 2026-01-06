/**
 * On-Chain Fee Tracking Service
 * 
 * Tracks revenue per vault by:
 * 1. Querying Alchemy's getAssetTransfers API for transfers to treasury wallet
 * 2. Mapping transfers back to vaults
 */

import { Address, formatUnits, getAddress } from 'viem';
import { publicClient } from './client';
import { vaultAddresses } from '@/lib/config/vaults';
import { logger } from '@/lib/utils/logger';
import { readERC20Data } from './contracts';

// Treasury address that receives fees
const TREASURY_ADDRESS = '0x057fd8B961Eb664baA647a5C7A6e9728fabA266A' as Address;

export interface VaultFeeTransfer {
  vaultAddress: Address;
  asset: Address;
  assetSymbol: string;
  assetDecimals: number; // Token decimals for proper formatting
  amount: bigint;
  amountUsd: number; // Will be calculated if price data available
  timestamp: number;
  blockNumber: bigint;
  transactionHash: string;
  from: Address; // Vault address
  to: Address; // Treasury address
  method: 'direct_transfer';
}

export interface VaultRevenueByPeriod {
  vaultAddress: Address;
  asset: string;
  totalRevenue: number; // USD
  transfers: VaultFeeTransfer[];
}


/**
 * Use Alchemy's getAssetTransfers API to track transfers to treasury wallet
 * This tracks direct transfers from vaults to the treasury
 */
export async function getTreasuryTransfers(
  fromBlock: number,
  toBlock: number | 'latest' = 'latest'
): Promise<VaultFeeTransfer[]> {
  const transfers: VaultFeeTransfer[] = [];

  if (!process.env.ALCHEMY_API_KEY) {
    logger.warn('ALCHEMY_API_KEY not set, cannot use getAssetTransfers API');
    return transfers;
  }

  try {
    const alchemyUrl = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

    const params: any = {
      fromBlock: `0x${fromBlock.toString(16)}`,
      toAddress: TREASURY_ADDRESS,
      category: ['erc20'],
      excludeZeroValue: true,
      maxCount: 1000,
    };

    if (toBlock !== 'latest') {
      params.toBlock = `0x${toBlock.toString(16)}`;
    }

    const response = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [params],
      }),
    });

    if (!response.ok) {
      logger.warn('Alchemy API request failed', {
        status: response.status,
      });
      return transfers;
    }

    const data = await response.json();
    if (data.error) {
      logger.warn('Alchemy API error', {
        error: data.error,
      });
      return transfers;
    }

    const transfersData = data.result?.transfers || [];

    for (const transfer of transfersData) {
      // Only process transfers from vaults
      const fromAddress = getAddress(transfer.from);
      const vaultAddress = await findVaultFromAddress(fromAddress);

      if (vaultAddress) {
        // This is a fee transfer from a vault
        const tokenAddress = getAddress(transfer.rawContract?.address || transfer.contractAddress);
        if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') continue;
        
        const amount = BigInt(transfer.value || 0);
        const timestamp = transfer.metadata?.blockTimestamp 
          ? new Date(transfer.metadata.blockTimestamp).getTime()
          : Date.now();

        // Get token info
        const tokenInfo = await readERC20Data(tokenAddress);
        if (!tokenInfo.symbol || tokenInfo.decimals === null || tokenInfo.decimals === undefined) continue;

        transfers.push({
          vaultAddress,
          asset: tokenAddress,
          assetSymbol: tokenInfo.symbol,
          assetDecimals: tokenInfo.decimals,
          amount,
          amountUsd: 0, // Will be calculated separately if price data available
          timestamp,
          blockNumber: BigInt(transfer.blockNum || 0),
          transactionHash: transfer.hash,
          from: fromAddress,
          to: TREASURY_ADDRESS,
          method: 'direct_transfer',
        });
      }
    }
  } catch (error) {
    logger.warn('Failed to get treasury transfers', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return transfers;
}

/**
 * Find vault address from a transaction or address
 */
async function findVaultFromAddress(address: Address): Promise<Address | null> {
  const normalizedAddress = getAddress(address);
  const vault = vaultAddresses.find(
    v => getAddress(v.address) === normalizedAddress
  );
  return vault ? getAddress(vault.address) : null;
}

/**
 * Find vault from transaction sender
 */
async function findVaultFromTransaction(
  from: Address,
  txHash: string
): Promise<Address | null> {
  // First check if sender is a vault
  const vault = await findVaultFromAddress(from);
  if (vault) return vault;

  // If not, check if transaction interacted with a vault
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    
    // Check if any vault was involved in the transaction
    for (const log of receipt.logs) {
      const vaultAddress = await findVaultFromAddress(log.address);
      if (vaultAddress) return vaultAddress;
    }
  } catch (error) {
    logger.warn('Failed to get transaction receipt', {
      txHash,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return null;
}


/**
 * Get block number for a given timestamp (approximate)
 */
async function getBlockNumberForTimestamp(timestamp: number): Promise<bigint> {
  try {
    // Get current block to estimate
    const currentBlock = await publicClient.getBlockNumber();
    const currentBlockData = await publicClient.getBlock({ blockNumber: currentBlock });
    const currentTimestamp = Number(currentBlockData.timestamp) * 1000;
    
    // Base has ~2 second block time
    const blockTimeMs = 2000;
    const timeDiff = currentTimestamp - timestamp;
    const blocksDiff = Math.floor(timeDiff / blockTimeMs);
    
    const targetBlock = currentBlock - BigInt(Math.max(0, blocksDiff));
    return targetBlock;
  } catch (error) {
    logger.warn('Failed to estimate block number', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Fallback: use a large lookback
    const currentBlock = await publicClient.getBlockNumber();
    return currentBlock - BigInt(100000); // ~5.5 days at 2s blocks
  }
}

/**
 * Get per-vault revenue from on-chain transfers
 */
export async function getVaultRevenueFromChain(
  startTimestamp: number,
  endTimestamp: number = Date.now()
): Promise<Map<Address, VaultRevenueByPeriod>> {
  const revenueMap = new Map<Address, VaultRevenueByPeriod>();

  try {
    // Get block numbers for the time range
    const [startBlock, endBlock] = await Promise.all([
      getBlockNumberForTimestamp(startTimestamp),
      getBlockNumberForTimestamp(endTimestamp),
    ]);

    // Get transfers from treasury
    const treasuryTransfers = await getTreasuryTransfers(Number(startBlock), Number(endBlock));

    // Deduplicate transfers
    const allTransfers = treasuryTransfers;
    const uniqueTransfers = new Map<string, VaultFeeTransfer>();

    for (const transfer of allTransfers) {
      // Filter by timestamp
      if (transfer.timestamp < startTimestamp || transfer.timestamp > endTimestamp) {
        continue;
      }

      // Deduplicate by transaction hash
      const key = `${transfer.transactionHash}-${transfer.vaultAddress}`;
      if (!uniqueTransfers.has(key)) {
        uniqueTransfers.set(key, transfer);
      }
    }

    // Group by vault
    for (const transfer of uniqueTransfers.values()) {
      if (!revenueMap.has(transfer.vaultAddress)) {
        revenueMap.set(transfer.vaultAddress, {
          vaultAddress: transfer.vaultAddress,
          asset: transfer.assetSymbol,
          totalRevenue: 0,
          transfers: [],
        });
      }

      const vaultRevenue = revenueMap.get(transfer.vaultAddress)!;
      vaultRevenue.transfers.push(transfer);
    }

    // Calculate total revenue (in native token units, not USD)
    // Note: USD conversion requires price oracle integration
    // For now, we sum the raw token amounts - caller should convert to USD using price data
    for (const [vaultAddress, revenue] of revenueMap.entries()) {
      // Sum up amounts (in native token units)
      // This is the total amount transferred, not USD value
      revenue.totalRevenue = revenue.transfers.reduce((sum, t) => {
        // Convert to human-readable token amount (not USD)
        const tokenAmount = Number(formatUnits(t.amount, t.assetDecimals));
        return sum + tokenAmount;
      }, 0);
    }
  } catch (error) {
    logger.warn('Failed to get vault revenue from chain', {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  return revenueMap;
}

/**
 * Get daily revenue per vault from on-chain data
 */
export async function getDailyVaultRevenue(
  startDate: Date,
  endDate: Date = new Date()
): Promise<Map<string, Map<Address, number>>> {
  // Map: date (YYYY-MM-DD) -> vault -> revenue (USD)
  const dailyRevenue = new Map<string, Map<Address, number>>();

  const startTimestamp = startDate.getTime();
  const endTimestamp = endDate.getTime();

  const revenueMap = await getVaultRevenueFromChain(startTimestamp, endTimestamp);

  // Group transfers by date
  for (const [vaultAddress, revenue] of revenueMap.entries()) {
    for (const transfer of revenue.transfers) {
      const date = new Date(transfer.timestamp);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!dailyRevenue.has(dateKey)) {
        dailyRevenue.set(dateKey, new Map());
      }

      const dayMap = dailyRevenue.get(dateKey)!;
      const currentRevenue = dayMap.get(vaultAddress) || 0;
      
      // Add transfer amount (in native token units, not USD)
      // Note: USD conversion requires price oracle integration
      // Using actual token decimals from the transfer
      const tokenAmount = Number(formatUnits(transfer.amount, transfer.assetDecimals));
      dayMap.set(vaultAddress, currentRevenue + tokenAmount);
    }
  }

  return dailyRevenue;
}

