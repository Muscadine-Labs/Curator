import { NextResponse } from 'next/server';
import { vaultAddresses } from '@/lib/config/vaults';
import { 
  BASE_CHAIN_ID, 
  GRAPHQL_FIRST_LIMIT,
  getDaysAgoTimestamp,
} from '@/lib/constants';
import { handleApiError, AppError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { gql } from 'graphql-request';
import { getAddress } from 'viem';
import type { Vault, VaultPosition, Maybe } from '@morpho-org/blue-api-sdk';
import { logger } from '@/lib/utils/logger';
import { 
  fetchDefiLlamaFees, 
  fetchDefiLlamaProtocol,
  getDailyFeesChart,
  getCumulativeFeesChart,
  getDailyRevenueChart,
  getCumulativeRevenueChart,
  getDailyInflowsChart,
  getCumulativeInflowsChart 
} from '@/lib/defillama/service';

// Vercel runtime configuration
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for Vercel Pro, adjust if needed
export const revalidate = 300; // cache heavy aggregation for 5 minutes

// Type-safe response matching our query structure
type ProtocolStatsQueryResponse = {
  vaults: {
    items: Maybe<Vault>[] | null;
  } | null;
  vaultPositions: {
    items: Maybe<VaultPosition>[] | null;
  } | null;
};

// Types for vault data
type VaultTvlData = {
  name: string;
  address: string;
  data: Array<{ date: string; value: number }>;
  performanceFee: number | null;
};

type HistoricalDataPoint = {
  x?: number;
  y?: number;
};

type V2VaultCheckResult = {
  name?: string;
  address?: string;
  performanceFee?: number;
  totalAssetsUsd?: number;
  asset?: { symbol?: string; address?: string } | null;
} | null;

type V1VaultCheckResult = {
  name?: string;
  address?: string;
  asset?: { symbol?: string; address?: string } | null;
} | null;

// Constants
const MIN_DATE = new Date('2025-06-01T00:00:00.000Z').getTime();
const HISTORICAL_QUERY_DAYS = 180; // trimmed to reduce payload/latency
const HOURS_THRESHOLD_FOR_CURRENT_TVL = 12;
const TVL_DIFF_THRESHOLD = 0.01;

// Helper: Normalize date to day-level precision (YYYY-MM-DD)
const normalizeDate = (dateStr: string): string => {
  return new Date(dateStr).toISOString().split('T')[0];
};

// Helper: Filter data points by minimum date
const filterByMinDate = <T extends { date: string }>(data: T[]): T[] => {
  return data.filter(point => new Date(point.date).getTime() >= MIN_DATE);
};

// Helper: Convert historical data points to chart format
const convertHistoricalDataPoints = (
  rawPoints: HistoricalDataPoint[]
): Array<{ date: string; value: number }> => {
  return rawPoints
    .map(point => ({
      date: point.x ? new Date(point.x * 1000).toISOString() : '',
      value: point.y ?? 0,
    }))
    .filter(p => p.date);
};

// Helper: Add current TVL to data points if needed
const addCurrentTvlIfNeeded = (
  dataPoints: Array<{ date: string; value: number }>,
  currentTvl: number | null | undefined
): Array<{ date: string; value: number }> => {
  if (currentTvl == null) return dataPoints;
  
  if (dataPoints.length === 0) {
    return [{ date: new Date().toISOString(), value: currentTvl }];
  }

  const latestPoint = dataPoints[dataPoints.length - 1];
  const latestDate = new Date(latestPoint.date);
  const hoursSinceLatest = (Date.now() - latestDate.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceLatest > HOURS_THRESHOLD_FOR_CURRENT_TVL || 
      Math.abs(latestPoint.value - currentTvl) > TVL_DIFF_THRESHOLD) {
    return [...dataPoints, { date: new Date().toISOString(), value: currentTvl }];
  }
  
  return dataPoints;
};

// Helper: Fetch V2 vault data
async function fetchV2VaultData(
  address: string,
  currentTvl: number | null
): Promise<VaultTvlData | null> {
  const v2CheckQuery = gql`
    query CheckV2Vault($address: String!, $chainId: Int!) {
      vaultV2ByAddress(address: $address, chainId: $chainId) {
        name
        address
        performanceFee
        totalAssetsUsd
        asset { symbol address }
      }
    }
  `;

  let v2Result: V2VaultCheckResult = null;
  try {
    const response = await morphoGraphQLClient.request<{ vaultV2ByAddress: V2VaultCheckResult }>(
      v2CheckQuery,
      { address, chainId: BASE_CHAIN_ID }
    );
    v2Result = response?.vaultV2ByAddress ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isNotFound = message.toLowerCase().includes('no results matching');
    logger[isNotFound ? 'info' : 'warn']('V2 vault check failed', {
      address,
      error: message,
    });
    return null;
  }

  if (!v2Result) return null;

  // Fetch historical data for V2 vaults
  const v2HistoricalQuery = gql`
    query V2VaultHistoricalTvl($address: String!, $chainId: Int!, $options: TimeseriesOptions) {
      vaultV2ByAddress(address: $address, chainId: $chainId) {
        name
        address
        historicalState {
          totalAssetsUsd(options: $options) {
            x
            y
          }
        }
      }
    }
  `;

  try {
    const v2HistResult = await morphoGraphQLClient.request<{
      vaultV2ByAddress?: {
        name?: string;
        address?: string;
        historicalState?: {
          totalAssetsUsd?: HistoricalDataPoint[];
        };
      } | null;
    }>(v2HistoricalQuery, {
      address,
      chainId: BASE_CHAIN_ID,
      options: {
        startTimestamp: getDaysAgoTimestamp(HISTORICAL_QUERY_DAYS),
        endTimestamp: Math.floor(Date.now() / 1000),
        interval: 'DAY',
      },
    });

    const historicalData = v2HistResult?.vaultV2ByAddress?.historicalState?.totalAssetsUsd;
    
    if (Array.isArray(historicalData) && historicalData.length > 0) {
      const dataPoints = convertHistoricalDataPoints(historicalData);
      const finalDataPoints = addCurrentTvlIfNeeded(
        dataPoints,
        v2Result.totalAssetsUsd ?? currentTvl
      );

      logger.info('V2 vault historical data fetched', {
        address,
        name: v2HistResult.vaultV2ByAddress?.name || v2Result.name,
        dataPoints: finalDataPoints.length,
      });

      return {
        name: v2HistResult.vaultV2ByAddress?.name || v2Result.name || `V2 Vault ${address.slice(0, 6)}...`,
        address: address.toLowerCase(),
        data: finalDataPoints,
        performanceFee: v2Result.performanceFee ?? null,
      };
    }
  } catch (error) {
    logger.warn('Failed to fetch V2 vault historical data', {
      address,
      name: v2Result.name,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Fallback: Use current TVL only
  if (v2Result.totalAssetsUsd != null || currentTvl != null) {
    return {
      name: v2Result.name || `V2 Vault ${address.slice(0, 6)}...`,
      address: address.toLowerCase(),
      data: [{
        date: new Date().toISOString(),
        value: v2Result.totalAssetsUsd ?? currentTvl!,
      }],
      performanceFee: v2Result.performanceFee ?? null,
    };
  }

  return null;
}

// Helper: Fetch V1 vault data
async function fetchV1VaultData(
  address: string,
  currentTvl: number | null
): Promise<VaultTvlData | null> {
  const v1CheckQuery = gql`
    query CheckVault($address: String!, $chainId: Int!) {
      vault: vaultByAddress(address: $address, chainId: $chainId) {
        name
        address
        asset { symbol address }
      }
    }
  `;

  let v1Result: V1VaultCheckResult = null;
  try {
    const result = await morphoGraphQLClient.request<{ vault: V1VaultCheckResult }>(
      v1CheckQuery,
      { address, chainId: BASE_CHAIN_ID }
    );
    v1Result = result.vault ?? null;
  } catch (error) {
    logger.warn('V1 vault check failed', {
      address,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // If no V1 vault found and no current TVL, return null
  if (!v1Result && currentTvl == null) {
    return null;
  }

  // Fetch historical data for V1 vaults
  const historicalQuery = gql`
    query VaultHistoricalTvl($address: String!, $chainId: Int!, $options: TimeseriesOptions) {
      vault: vaultByAddress(address: $address, chainId: $chainId) {
        name
        address
        asset { symbol address }
        historicalState {
          totalAssetsUsd(options: $options) {
            x
            y
          }
        }
      }
    }
  `;

  let histResult: {
    vault?: {
      name?: string;
      address?: string;
      asset?: { symbol?: string; address?: string } | null;
      historicalState?: {
        totalAssetsUsd?: HistoricalDataPoint[];
      };
    } | null;
  } | null = null;

  try {
    histResult = await morphoGraphQLClient.request<{
      vault?: {
        name?: string;
        address?: string;
        asset?: { symbol?: string; address?: string } | null;
        historicalState?: {
          totalAssetsUsd?: HistoricalDataPoint[];
        };
      } | null;
    }>(historicalQuery, {
      address,
      chainId: BASE_CHAIN_ID,
      options: {
        startTimestamp: getDaysAgoTimestamp(HISTORICAL_QUERY_DAYS),
        endTimestamp: Math.floor(Date.now() / 1000),
        interval: 'DAY',
      },
    });

    const historicalData = histResult?.vault?.historicalState?.totalAssetsUsd;
    
    if (Array.isArray(historicalData) && historicalData.length > 0) {
      const dataPoints = convertHistoricalDataPoints(historicalData);
      const finalDataPoints = addCurrentTvlIfNeeded(dataPoints, currentTvl);

      logger.info('V1 vault historical data fetched', {
        address,
        name: histResult.vault?.name || v1Result?.name || 'Unknown',
        dataPoints: finalDataPoints.length,
      });

      return {
        name: histResult.vault?.name || v1Result?.name || `Vault ${address.slice(0, 6)}...`,
        address: address.toLowerCase(),
        data: finalDataPoints,
        performanceFee: null,
      };
    }
  } catch (error) {
    logger.warn('Failed to fetch V1 vault historical data', {
      address,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Fallback: Use current TVL if available
  if (currentTvl != null) {
    return {
      name: v1Result?.name || histResult?.vault?.name || `Vault ${address.slice(0, 6)}...`,
      address: address.toLowerCase(),
      data: [{
        date: new Date().toISOString(),
        value: currentTvl,
      }],
      performanceFee: null,
    };
  }

  return null;
}

// Helper: Aggregate TVL trend from individual vault data
function aggregateTvlTrend(
  tvlByVault: Array<{ name: string; address: string; data: Array<{ date: string; value: number }> }>
): Array<{ date: string; value: number }> {
  if (tvlByVault.length === 0) {
    return [];
  }

  const dateMap = new Map<string, number>();
  const dateToOriginalDate = new Map<string, string>();

  // Group vault data by normalized date, keeping latest value per vault per day
  const vaultDataByDate = new Map<string, Map<string, { value: number; date: string }>>();

  tvlByVault.forEach((vault) => {
    vault.data.forEach((point) => {
      if (!point.date || point.value == null) return;

      const normalizedDate = normalizeDate(point.date);

      if (!vaultDataByDate.has(normalizedDate)) {
        vaultDataByDate.set(normalizedDate, new Map());
      }

      const vaultMap = vaultDataByDate.get(normalizedDate)!;
      const existing = vaultMap.get(vault.name);

      // Keep only the latest value per vault per day
      if (!existing || new Date(point.date) > new Date(existing.date)) {
        vaultMap.set(vault.name, { value: point.value, date: point.date });
      }
    });
  });

  // Aggregate: sum the latest value from each vault for each date
  vaultDataByDate.forEach((vaultMap, normalizedDate) => {
    let sum = 0;
    let latestDate = '';

    vaultMap.forEach(({ value, date }) => {
      sum += value;
      if (!latestDate || new Date(date) > new Date(latestDate)) {
        latestDate = date;
      }
    });

    dateMap.set(normalizedDate, sum);
    dateToOriginalDate.set(normalizedDate, latestDate);
  });

  // Convert to array and sort by date
  return Array.from(dateMap.entries())
    .map(([normalizedDate, value]) => ({
      date: dateToOriginalDate.get(normalizedDate) || normalizedDate,
      value,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Helper: Calculate average performance fee rate
function calculateAveragePerformanceFeeRate(
  v1Vaults: Vault[],
  v2PerformanceFees: Array<{ performanceFee: number }>
): number | null {
  const v1FeeRates = v1Vaults
    .map(v => v.state?.fee)
    .filter((f): f is number => f !== null && f !== undefined && f > 0);

  const v2FeeRates = v2PerformanceFees
    .map(v => v.performanceFee)
    .filter((f): f is number => f !== null && f !== undefined && f > 0 && !Number.isNaN(f));

  const allFeeRates = [...v1FeeRates, ...v2FeeRates];

  if (allFeeRates.length === 0) {
    return null;
  }

  return allFeeRates.reduce((a, b) => a + b, 0) / allFeeRates.length;
}

export async function GET(request: Request) {
  // Rate limiting
  const rateLimitMiddleware = createRateLimitMiddleware(
    RATE_LIMIT_REQUESTS_PER_MINUTE,
    MINUTE_MS
  );
  const rateLimitResult = rateLimitMiddleware(request);
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { 
        status: 429,
        headers: rateLimitResult.headers,
      }
    );
  }

  try {
    logger.info('Fetching protocol stats', {
      vaultCount: vaultAddresses.length,
      environment: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
    });

    const addresses = vaultAddresses.map(v => getAddress(v.address));
    if (!addresses.length) {
      logger.error('No vaults configured', new Error('NO_VAULTS_CONFIGURED'));
      throw new AppError('No vaults configured', 500, 'NO_VAULTS_CONFIGURED');
    }

    // Main query for V1 vaults and positions
    const query = gql`
      query FetchProtocolStats($addresses: [String!]) {
        vaults(
          first: ${GRAPHQL_FIRST_LIMIT}
          where: { address_in: $addresses, chainId_in: [${BASE_CHAIN_ID}] }
        ) {
          items {
            address
            state { 
              totalAssetsUsd
              fee
            }
          }
        }

        vaultPositions(
          first: ${GRAPHQL_FIRST_LIMIT}
          where: { vaultAddress_in: $addresses }
        ) {
          items {
            vault { address }
            user { address }
          }
        }
      }
    `;

    logger.info('Fetching vault data from GraphQL', { addressCount: addresses.length });
    
    const data = await morphoGraphQLClient.request<ProtocolStatsQueryResponse>(
      query,
      { addresses }
    );

    logger.info('GraphQL data received', {
      vaultCount: data.vaults?.items?.length ?? 0,
      positionCount: data.vaultPositions?.items?.length ?? 0,
    });

    const morphoVaults = data.vaults?.items?.filter((v): v is Vault => v !== null) ?? [];
    const positions = data.vaultPositions?.items?.filter((p): p is VaultPosition => p !== null) ?? [];

    // Calculate totalDeposited from V1 vaults (will add V2 below)
    let totalDeposited = morphoVaults.reduce((sum, v) => sum + (v.state?.totalAssetsUsd ?? 0), 0);
    const activeVaults = vaultAddresses.length;

    // Create a map of current TVL for fallback
    const vaultCurrentTvl = new Map<string, number>();
    morphoVaults.forEach(v => {
      if (v.address && v.state?.totalAssetsUsd != null) {
        vaultCurrentTvl.set(v.address.toLowerCase(), v.state.totalAssetsUsd);
      }
    });

    // Fetch historical TVL data per vault (V1 and V2)
    const tvlByVaultPromises = addresses.map(async (address): Promise<VaultTvlData | null> => {
      const currentTvl = vaultCurrentTvl.get(address.toLowerCase()) ?? null;

      try {
        // Try V2 first (newer vaults)
        const v2Data = await fetchV2VaultData(address, currentTvl);
        if (v2Data) return v2Data;

        // Fallback to V1
        const v1Data = await fetchV1VaultData(address, currentTvl);
        if (v1Data) return v1Data;

        // Last resort: use current TVL if available
        if (currentTvl != null) {
          logger.warn('Vault not detected as V1/V2 but has current TVL', {
            address,
            currentTvl,
          });
          return {
            name: `Vault ${address.slice(0, 6)}...`,
            address: address.toLowerCase(),
            data: [{ date: new Date().toISOString(), value: currentTvl }],
            performanceFee: null,
          };
        }

        return null;
      } catch (error) {
        logger.warn('Failed to fetch TVL data for vault', {
          address,
          error: error instanceof Error ? error.message : String(error),
        });
        
        // Fallback to current TVL if available
        if (currentTvl != null) {
          return {
            name: `Vault ${address.slice(0, 6)}...`,
            address: address.toLowerCase(),
            data: [{ date: new Date().toISOString(), value: currentTvl }],
            performanceFee: null,
          };
        }
        
        return null;
      }
    });

    const tvlByVaultResults = await Promise.all(tvlByVaultPromises);
    
    // Extract V2 performance fees before filtering
    const v2PerformanceFees = tvlByVaultResults
      .filter((v): v is VaultTvlData => 
        v !== null && v.performanceFee != null && v.performanceFee !== null
      )
      .map(v => ({ performanceFee: v.performanceFee as number }));

    // Filter and process vault data
    let tvlByVault = tvlByVaultResults
      .filter((v): v is VaultTvlData => v !== null && v.data.length > 0)
      .map((v) => {
        // Remove performanceFee field for response
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        const { performanceFee: __performanceFee, ...rest } = v;
        return rest;
      });

    // Add V2 vault TVL to totalDeposited
    const v2VaultTvl = tvlByVaultResults
      .filter((v): v is VaultTvlData => 
        v !== null && 
        v.performanceFee !== null && 
        v.performanceFee !== undefined
      )
      .reduce((sum, v) => {
        const latestPoint = v.data[v.data.length - 1];
        return sum + (latestPoint?.value ?? 0);
      }, 0);
    totalDeposited += v2VaultTvl;

    // Calculate unique users
    const uniqueUsers = new Set<string>();
    positions.forEach(p => {
      const userAddress = p.user?.address?.toLowerCase();
      if (userAddress) {
        uniqueUsers.add(userAddress);
      }
    });

    // Fetch DefiLlama data for charts
    let feesTrendDaily: Array<{ date: string; value: number }> = [];
    let feesTrendCumulative: Array<{ date: string; value: number }> = [];
    let revenueTrendDaily: Array<{ date: string; value: number }> = [];
    let revenueTrendCumulative: Array<{ date: string; value: number }> = [];
    let inflowsTrendDaily: Array<{ date: string; value: number }> = [];
    let inflowsTrendCumulative: Array<{ date: string; value: number }> = [];
    let totalFeesGenerated = 0;
    let totalInterestGenerated = 0;

    try {
      const [feesData, protocolData] = await Promise.all([
        fetchDefiLlamaFees(),
        fetchDefiLlamaProtocol(),
      ]);

      const avgPerformanceFeeRate = calculateAveragePerformanceFeeRate(
        morphoVaults,
        v2PerformanceFees
      );

      if (feesData) {
        feesTrendDaily = getDailyFeesChart(feesData);
        feesTrendCumulative = getCumulativeFeesChart(feesData);

        if (avgPerformanceFeeRate !== null) {
          revenueTrendDaily = getDailyRevenueChart(feesData, avgPerformanceFeeRate);
          revenueTrendCumulative = getCumulativeRevenueChart(feesData, avgPerformanceFeeRate);
        }

        if (feesData.totalAllTime) {
          totalInterestGenerated = feesData.totalAllTime;
          if (avgPerformanceFeeRate !== null) {
            totalFeesGenerated = feesData.totalAllTime * avgPerformanceFeeRate;
          }
        }
      }

      if (protocolData) {
        inflowsTrendDaily = getDailyInflowsChart(protocolData, feesData);
        inflowsTrendCumulative = getCumulativeInflowsChart(protocolData, feesData);
      }
    } catch (error) {
      logger.error('Failed to fetch DefiLlama data', error as Error);
    }

    // Aggregate TVL trend from individual vault data
    let tvlTrend: Array<{ date: string; value: number }> = [];
    
    if (tvlByVault.length > 0) {
      tvlTrend = aggregateTvlTrend(tvlByVault);
      
      logger.info('TVL trend aggregated from vault data', {
        vaults: tvlByVault.length,
        dataPoints: tvlTrend.length,
        lastValue: tvlTrend[tvlTrend.length - 1]?.value,
      });
    } else {
      // Fallback placeholder
      const now = new Date();
      const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
      tvlTrend = Array.from({ length: 60 }, (_, i) => {
        const date = new Date(sixtyDaysAgo.getTime() + i * (60 * 24 * 60 * 60 * 1000) / 60);
        return { date: date.toISOString(), value: totalDeposited };
      });
      logger.warn('No vault data available, using placeholder TVL trend');
    }

    // Filter all graph data to exclude dates before June 1, 2025
    tvlTrend = filterByMinDate(tvlTrend);
    tvlByVault = tvlByVault.map(vault => ({
      ...vault,
      data: filterByMinDate(vault.data),
    }));
    feesTrendDaily = filterByMinDate(feesTrendDaily);
    feesTrendCumulative = filterByMinDate(feesTrendCumulative);
    revenueTrendDaily = filterByMinDate(revenueTrendDaily);
    revenueTrendCumulative = filterByMinDate(revenueTrendCumulative);
    inflowsTrendDaily = filterByMinDate(inflowsTrendDaily);
    inflowsTrendCumulative = filterByMinDate(inflowsTrendCumulative);

    const stats = {
      totalDeposited,
      totalFeesGenerated,
      activeVaults,
      totalInterestGenerated,
      users: uniqueUsers.size,
      tvlTrend,
      tvlByVault: tvlByVault.map((v) => ({
        name: v.name,
        address: v.address,
        key: `vault-${v.address}`,
        data: v.data,
      })),
      feesTrendDaily,
      feesTrendCumulative,
      revenueTrendDaily,
      revenueTrendCumulative,
      inflowsTrendDaily,
      inflowsTrendCumulative,
    };

    const responseHeaders = new Headers(rateLimitResult.headers);
    responseHeaders.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    logger.info('Protocol stats fetched successfully', {
      totalDeposited,
      activeVaults,
      users: uniqueUsers.size,
      tvlTrendPoints: tvlTrend.length,
    });

    return NextResponse.json(stats, { headers: responseHeaders });
  } catch (err) {
    logger.error('Failed to fetch protocol stats', err instanceof Error ? err : new Error(String(err)), {
      errorType: err instanceof Error ? err.constructor.name : typeof err,
    });
    const { error, statusCode } = handleApiError(err, 'Failed to fetch protocol stats');
    return NextResponse.json(error, { status: statusCode });
  }
}
