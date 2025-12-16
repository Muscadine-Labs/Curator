import { Address, Abi } from 'viem';
import { publicClient, safeContractRead } from '@/lib/onchain/client';

// Chainlink AggregatorV3Interface ABI
const CHAINLINK_ORACLE_ABI = [
  {
    name: 'latestRoundData',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
  },
] as const;

// Morpho oracle ABI - MorphoChainlinkOracleV2 uses getBaseFeed(uint256 index)
const MORPHO_ORACLE_ABI_PATTERNS = [
  // Primary: getBaseFeed(uint256) - MorphoChainlinkOracleV2 standard function
  {
    name: 'getBaseFeed',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  // Fallback patterns for other oracle types
  {
    name: 'baseFeed',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'feeds',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'baseFeeds',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export interface OracleTimestampData {
  chainlinkAddress: Address | null;
  updatedAt: number | null; // Unix timestamp in seconds
  ageSeconds: number | null; // Age of the update in seconds
}

/**
 * Try to resolve the Chainlink feed address from a Morpho oracle contract.
 * Attempts multiple function patterns to find the underlying Chainlink aggregator.
 */
async function resolveChainlinkFeed(oracleAddress: Address): Promise<Address | null> {
  // Primary: Try getBaseFeed(1) - MorphoChainlinkOracleV2 standard function for "base feed 1"
  const getBaseFeed1Result = await safeContractRead<Address>(
    oracleAddress,
    MORPHO_ORACLE_ABI_PATTERNS.filter((f) => f.name === 'getBaseFeed') as Abi,
    'getBaseFeed',
    [1]
  );
  if (getBaseFeed1Result && getBaseFeed1Result !== '0x0000000000000000000000000000000000000000') {
    return getBaseFeed1Result;
  }

  // Fallback: Try getBaseFeed(0) - sometimes index 0
  const getBaseFeed0Result = await safeContractRead<Address>(
    oracleAddress,
    MORPHO_ORACLE_ABI_PATTERNS.filter((f) => f.name === 'getBaseFeed') as Abi,
    'getBaseFeed',
    [0]
  );
  if (getBaseFeed0Result && getBaseFeed0Result !== '0x0000000000000000000000000000000000000000') {
    return getBaseFeed0Result;
  }

  // Fallback patterns for other oracle types
  const baseFeedResult = await safeContractRead<Address>(
    oracleAddress,
    MORPHO_ORACLE_ABI_PATTERNS.filter((f) => f.name === 'baseFeed') as Abi,
    'baseFeed',
    []
  );
  if (baseFeedResult && baseFeedResult !== '0x0000000000000000000000000000000000000000') {
    return baseFeedResult;
  }

  // Try feeds(1)
  const feeds1Result = await safeContractRead<Address>(
    oracleAddress,
    MORPHO_ORACLE_ABI_PATTERNS.filter((f) => f.name === 'feeds') as Abi,
    'feeds',
    [1]
  );
  if (feeds1Result && feeds1Result !== '0x0000000000000000000000000000000000000000') {
    return feeds1Result;
  }

  // Try baseFeeds(1)
  const baseFeeds1Result = await safeContractRead<Address>(
    oracleAddress,
    MORPHO_ORACLE_ABI_PATTERNS.filter((f) => f.name === 'baseFeeds') as Abi,
    'baseFeeds',
    [1]
  );
  if (baseFeeds1Result && baseFeeds1Result !== '0x0000000000000000000000000000000000000000') {
    return baseFeeds1Result;
  }

  return null;
}

/**
 * Get the last update timestamp from a Chainlink oracle.
 * Returns null if the contract doesn't implement latestRoundData.
 */
async function getChainlinkTimestamp(chainlinkAddress: Address): Promise<number | null> {
  try {
    const result = await publicClient.readContract({
      address: chainlinkAddress,
      abi: CHAINLINK_ORACLE_ABI as Abi,
      functionName: 'latestRoundData',
    }) as [bigint, bigint, bigint, bigint, bigint];

    const [, , , updatedAt] = result;
    return Number(updatedAt);
  } catch {
    return null;
  }
}

/**
 * Get oracle timestamp data for a Morpho oracle address.
 * 
 * Flow:
 * 1. Get baseFeedOne address (prefer GraphQL oracle.data.baseFeedOne.address if available, otherwise resolve on-chain)
 * 2. Query the Chainlink feed (baseFeedOne) for latestRoundData() to get updatedAt timestamp
 * 3. Calculate age from current time
 * 
 * @param oracleAddress - The Morpho oracle contract address
 * @param baseFeedOneAddress - Optional: baseFeedOne address from GraphQL oracle.data (more efficient than on-chain resolution)
 */
export async function getOracleTimestampData(
  oracleAddress: Address | null,
  baseFeedOneAddress?: Address | null
): Promise<OracleTimestampData> {
  if (!oracleAddress || oracleAddress.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    return {
      chainlinkAddress: null,
      updatedAt: null,
      ageSeconds: null,
    };
  }

  // First, try to use baseFeedOne from GraphQL if provided (more efficient)
  let chainlinkAddress: Address | null = null;
  
  if (baseFeedOneAddress && baseFeedOneAddress.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
    chainlinkAddress = baseFeedOneAddress;
  } else {
    // Fallback: Try to resolve Chainlink feed on-chain
    chainlinkAddress = await resolveChainlinkFeed(oracleAddress);
  }

  if (!chainlinkAddress) {
    return {
      chainlinkAddress: null,
      updatedAt: null,
      ageSeconds: null,
    };
  }

  // Get timestamp from Chainlink feed (baseFeedOne)
  const updatedAt = await getChainlinkTimestamp(chainlinkAddress);
  if (updatedAt === null) {
    return {
      chainlinkAddress,
      updatedAt: null,
      ageSeconds: null,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const ageSeconds = now - updatedAt;

  return {
    chainlinkAddress,
    updatedAt,
    ageSeconds,
  };
}
