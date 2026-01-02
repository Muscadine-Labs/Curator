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

// Type-safe response matching our query structure
type ProtocolStatsQueryResponse = {
  vaults: {
    items: Maybe<Vault>[] | null;
  } | null;
  vaultPositions: {
    items: Maybe<VaultPosition>[] | null;
  } | null;
};

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
    const addresses = vaultAddresses.map(v => getAddress(v.address));
    if (!addresses.length) {
      throw new AppError('No vaults configured', 500, 'NO_VAULTS_CONFIGURED');
    }

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

    const data = await morphoGraphQLClient.request<ProtocolStatsQueryResponse>(
      query,
      { addresses }
    );

    const morphoVaults = data.vaults?.items?.filter((v): v is Vault => v !== null) ?? [];
    const positions = data.vaultPositions?.items?.filter((p): p is VaultPosition => p !== null) ?? [];

    // Calculate totalDeposited from V1 vaults (from main query)
    let totalDeposited = morphoVaults.reduce((sum, v) => sum + (v.state?.totalAssetsUsd ?? 0), 0);
    const activeVaults = vaultAddresses.length;

    // Create a map of V1 vault current TVL for fallback
    const v1VaultCurrentTvl = new Map<string, number>();
    morphoVaults.forEach(v => {
      if (v.address && v.state?.totalAssetsUsd != null) {
        v1VaultCurrentTvl.set(v.address.toLowerCase(), v.state.totalAssetsUsd);
      }
    });
    
    logger.info('V1 vaults from main query', {
      totalMorphoVaults: morphoVaults.length,
      vaultAddresses: morphoVaults.map(v => v.address?.toLowerCase()),
      v1VaultCurrentTvlMap: Array.from(v1VaultCurrentTvl.entries()),
      allAddresses: addresses.map(a => a.toLowerCase()),
    });

    // Fetch historical TVL data per vault (V1 has historical, V2 has current only)
    // Also collect V2 performance fees for revenue calculation and asset information
    // Note: V2 vaults will be added to totalDeposited below
    const tvlByVaultPromises = addresses.map(async (address) => {
      try {
        // First check if it's a V2 vault (also fetch performanceFee for revenue calculation)
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
        let v2Result: { vaultV2ByAddress?: { name?: string; address?: string; performanceFee?: number; totalAssetsUsd?: number; asset?: { symbol?: string; address?: string } | null } | null } | null = null;
        try {
          v2Result = await morphoGraphQLClient.request<{ vaultV2ByAddress?: { name?: string; address?: string; performanceFee?: number; totalAssetsUsd?: number; asset?: { symbol?: string; address?: string } | null } | null }>(v2CheckQuery, { address, chainId: BASE_CHAIN_ID });
        } catch (v2CheckError) {
          const message = v2CheckError instanceof Error ? v2CheckError.message : String(v2CheckError);
          const isNotFound = message.toLowerCase().includes('no results matching');
          logger[isNotFound ? 'info' : 'warn']('V2 vault check failed, will try V1 path', {
            address,
            error: message,
          });
        }
        
        // Check if V2 vault exists (not null/undefined), even if name is missing
        if (v2Result?.vaultV2ByAddress !== null && v2Result?.vaultV2ByAddress !== undefined) {
          // Fetch historical data for V2 vaults (they should support it)
          try {
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
            
            // V2 vaults require options parameter - use a wide date range to get all available data
            const v2HistResult = await morphoGraphQLClient.request<{ vaultV2ByAddress?: { name?: string; address?: string; historicalState?: { totalAssetsUsd?: Array<{ x?: number; y?: number }> } } | null }>(v2HistoricalQuery, {
              address,
              chainId: BASE_CHAIN_ID,
              options: {
                // Use a very old timestamp (2 years ago) to ensure we get all available historical data
                // API will return data from vault deployment date, not from this timestamp
                startTimestamp: getDaysAgoTimestamp(730), // 2 years ago - API returns what's available
                endTimestamp: Math.floor(Date.now() / 1000),
                interval: 'DAY'
              }
            });

            // Check if we got historical data
            const v2HistoricalData = v2HistResult?.vaultV2ByAddress?.historicalState?.totalAssetsUsd;
            if (Array.isArray(v2HistoricalData) && v2HistoricalData.length > 0) {
              // V2 vault has historical data
              const dataPoints = v2HistoricalData.map(point => ({
                date: point.x ? new Date(point.x * 1000).toISOString() : '',
                value: point.y ?? 0,
              })).filter(p => p.date);

              // Add current TVL if not already the latest point
              const currentTvl = v2Result.vaultV2ByAddress.totalAssetsUsd;
              if (dataPoints.length > 0 && currentTvl != null) {
                const latestPoint = dataPoints[dataPoints.length - 1];
                const latestDate = new Date(latestPoint.date);
                const hoursSinceLatest = (Date.now() - latestDate.getTime()) / (1000 * 60 * 60);
                
                if (hoursSinceLatest > 12 || Math.abs(latestPoint.value - currentTvl) > 0.01) {
                  dataPoints.push({
                    date: new Date().toISOString(),
                    value: currentTvl,
                  });
                }
              } else if (currentTvl != null) {
                dataPoints.push({
                  date: new Date().toISOString(),
                  value: currentTvl,
                });
              }

              logger.info('V2 vault historical data fetched', {
                address,
                name: v2HistResult.vaultV2ByAddress?.name || v2Result.vaultV2ByAddress.name,
                rawDataPoints: v2HistoricalData.length,
                processedDataPoints: dataPoints.length,
              });

              return {
                name: v2HistResult.vaultV2ByAddress?.name || v2Result.vaultV2ByAddress.name || `V2 Vault ${address.slice(0, 6)}...`,
                address: address.toLowerCase(),
                data: dataPoints,
                performanceFee: v2Result.vaultV2ByAddress.performanceFee ?? null,
              };
            } else {
              // No historical data returned - log warning
              logger.warn('V2 vault historical data query returned empty or invalid data', {
                address,
                name: v2Result.vaultV2ByAddress.name,
                hasHistoricalState: !!v2HistResult?.vaultV2ByAddress?.historicalState,
                hasTotalAssetsUsd: !!v2HistResult?.vaultV2ByAddress?.historicalState?.totalAssetsUsd,
                dataLength: Array.isArray(v2HistoricalData) ? v2HistoricalData.length : 'not an array',
              });
            }
          } catch (v2HistError) {
            logger.warn('Failed to fetch V2 vault historical data', {
              address,
              name: v2Result.vaultV2ByAddress.name,
              error: v2HistError instanceof Error ? v2HistError.message : String(v2HistError),
            });
          }

          // Fallback: V2 vault without historical data, use current TVL
          // This should rarely happen if V2 vaults properly support historical data
          const currentDate = new Date().toISOString();
          return {
            name: v2Result.vaultV2ByAddress.name || `V2 Vault ${address.slice(0, 6)}...`,
            address: address.toLowerCase(),
            data: v2Result.vaultV2ByAddress.totalAssetsUsd != null ? [{
              date: currentDate,
              value: v2Result.vaultV2ByAddress.totalAssetsUsd,
            }] : [],
            performanceFee: v2Result.vaultV2ByAddress.performanceFee ?? null,
          };
        }
        
        // Check if it's a V1 vault
        const v1CheckQuery = gql`
          query CheckVault($address: String!, $chainId: Int!) {
            vault: vaultByAddress(address: $address, chainId: $chainId) {
              name
              address
              asset { symbol address }
            }
          }
        `;
        const v1Result = await morphoGraphQLClient.request<{ vault?: { name?: string; address?: string; asset?: { symbol?: string; address?: string } | null } | null }>(v1CheckQuery, { address, chainId: BASE_CHAIN_ID });
        
        logger.info('V1 vault check result', {
          address,
          addressLower: address.toLowerCase(),
          hasVault: !!v1Result.vault,
          vaultName: v1Result.vault?.name,
          hasCurrentTvl: v1VaultCurrentTvl.has(address.toLowerCase()),
          currentTvl: v1VaultCurrentTvl.get(address.toLowerCase()),
        });
        
        // If V2 check returned null/undefined, this is a V1 vault (or doesn't exist)
        // Try to fetch historical data for V1 vaults using GraphQL
        // Also check if we have current TVL from main query - if so, it's definitely a V1 vault
        const currentTvl = v1VaultCurrentTvl.get(address.toLowerCase());
        const isV1Vault = v1Result.vault || currentTvl != null;
        if (isV1Vault) {
          // If v1Result.vault is null but we have current TVL, we'll still try to fetch historical data
          // The historical query will get the vault name and asset info
          if (!v1Result.vault && currentTvl != null) {
            logger.info('V1 vault found in main query but not in individual check, will fetch from historical query', {
              address,
              currentTvl,
            });
          }
          logger.info('V1 vault detected, fetching historical data', {
            address,
            vaultName: v1Result.vault?.name || 'Unknown (will fetch from historical query)',
            hasVaultFromCheck: !!v1Result.vault,
            hasCurrentTvl: currentTvl != null,
          });
          // This is a V1 vault, fetch historical data from GraphQL
          try {
            // Fetch historical data for V1 vaults
            // Use a very wide date range - API will return all available data from vault deployment
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
            
            // V1 vaults require options parameter - use a very wide date range to get all available data
            let histResult: { vault?: { name?: string; address?: string; asset?: { symbol?: string; address?: string } | null; historicalState?: { totalAssetsUsd?: Array<{ x?: number; y?: number }> } } | null } | null = null;
            
            try {
              histResult = await morphoGraphQLClient.request<{ vault?: { name?: string; address?: string; asset?: { symbol?: string; address?: string } | null; historicalState?: { totalAssetsUsd?: Array<{ x?: number; y?: number }> } } | null }>(historicalQuery, {
                address,
                chainId: BASE_CHAIN_ID,
                options: {
                  // Use a very old timestamp (2 years ago) to ensure we get all available historical data
                  // API will return data from vault deployment date, not from this timestamp
                  startTimestamp: getDaysAgoTimestamp(730), // 2 years ago - API returns what's available
                  endTimestamp: Math.floor(Date.now() / 1000),
                  interval: 'DAY'
                }
              });
            } catch (histError) {
              logger.warn('V1 vault historical query failed', {
                address,
                error: histError instanceof Error ? histError.message : String(histError),
              });
              histResult = null;
            }
            
            // Check if we got historical data (could be empty array or null/undefined)
            if (histResult?.vault?.historicalState?.totalAssetsUsd) {
              const historicalData = histResult.vault.historicalState.totalAssetsUsd;
              if (Array.isArray(historicalData) && historicalData.length > 0) {
                const rawDataPoints = historicalData;
                
                logger.info('V1 vault historical data fetched', {
                  address,
                  name: histResult.vault?.name || v1Result.vault?.name || 'Unknown',
                  rawDataPoints: rawDataPoints.length,
                  samplePoints: rawDataPoints.slice(0, 3).map(p => ({ x: p.x, y: p.y })),
                });
                
                // Convert all data points - don't filter by value > 0, use whatever API returns
                // Each vault may have different amounts of data, that's fine
                const dataPoints = rawDataPoints.map(point => ({
                  date: point.x ? new Date(point.x * 1000).toISOString() : '',
                  value: point.y ?? 0, // Use 0 if null/undefined, but keep the data point
                })).filter(p => p.date); // Only filter out invalid dates
                
                logger.info('V1 vault processed data points', {
                  address,
                  rawDataPoints: rawDataPoints.length,
                  processedDataPoints: dataPoints.length,
                  firstDate: dataPoints[0]?.date,
                  lastDate: dataPoints[dataPoints.length - 1]?.date,
                });
                
                // Get current TVL from morphoVaults to ensure we have latest data point
                const currentTvl = v1VaultCurrentTvl.get(address.toLowerCase());
                const currentDate = new Date().toISOString();
                
                // Add current TVL if it's not already the latest point or if we have no historical data
                if (dataPoints.length > 0) {
                  // Check if latest point is today (within last 24 hours)
                  const latestPoint = dataPoints[dataPoints.length - 1];
                  const latestDate = new Date(latestPoint.date);
                  const hoursSinceLatest = (Date.now() - latestDate.getTime()) / (1000 * 60 * 60);
                  
                  // Add current TVL if latest point is more than 12 hours old, or if current TVL differs
                  if (hoursSinceLatest > 12 || (currentTvl != null && Math.abs(latestPoint.value - currentTvl) > 0.01)) {
                    dataPoints.push({
                      date: currentDate,
                      value: currentTvl ?? latestPoint.value,
                    });
                  }
                } else if (currentTvl != null) {
                  // No historical data, but we have current TVL - use it
                  dataPoints.push({
                    date: currentDate,
                    value: currentTvl,
                  });
                }
                
                if (dataPoints.length > 0) {
                  const vaultName = histResult.vault?.name || v1Result.vault?.name || `Vault ${address.slice(0, 6)}...`;
                  logger.info('V1 vault returning data', {
                    address,
                    name: vaultName,
                    dataPoints: dataPoints.length,
                  });
                  return {
                    name: vaultName,
                    address: address.toLowerCase(),
                    data: dataPoints,
                    performanceFee: null, // V1 vaults don't contribute performanceFee here
                  };
                }
              }
            }
            
            // No historical data or empty array - check what we got and fallback to current TVL
            const currentTvl = v1VaultCurrentTvl.get(address.toLowerCase());
            const hasVault = !!histResult?.vault;
            const hasHistoricalState = !!histResult?.vault?.historicalState;
            const historicalDataArray = histResult?.vault?.historicalState?.totalAssetsUsd;
            const historicalDataLength = Array.isArray(historicalDataArray) ? historicalDataArray.length : 'not an array';
            
            logger.warn('V1 vault has no historicalState data', {
              address,
              name: v1Result.vault?.name || histResult?.vault?.name || 'Unknown',
              hasVaultFromCheck: !!v1Result.vault,
              hasVaultFromHist: hasVault,
              hasHistoricalState,
              hasTotalAssetsUsd: !!histResult?.vault?.historicalState?.totalAssetsUsd,
              historicalDataLength,
              historicalDataType: Array.isArray(historicalDataArray) ? 'array' : typeof historicalDataArray,
            });
            
            // Fallback to current TVL if available
            if (currentTvl != null) {
              const vaultName = v1Result.vault?.name || histResult?.vault?.name || `Vault ${address.slice(0, 6)}...`;
              return {
                name: vaultName,
                address: address.toLowerCase(),
                data: [{
                  date: new Date().toISOString(),
                  value: currentTvl,
                }],
                performanceFee: null,
              };
            }
            
            // If no historical data and no current TVL, return null (will be filtered out)
            logger.warn('V1 vault has no historical data and no current TVL', {
              address,
              name: v1Result.vault?.name || histResult?.vault?.name || 'Unknown',
            });
          } catch (histError) {
            logger.warn('Failed to fetch V1 vault historical data', {
              address,
              error: histError instanceof Error ? histError.message : String(histError),
            });
            // Fallback to current TVL if available
            if (currentTvl != null) {
              const vaultName = v1Result.vault?.name || `Vault ${address.slice(0, 6)}...`;
              return {
                name: vaultName,
                address: address.toLowerCase(),
                data: [{
                  date: new Date().toISOString(),
                  value: currentTvl,
                }],
                performanceFee: null,
              };
            }
          }
        } else {
          // Not a V1 vault and not a V2 vault - check if we have current TVL anyway
          const currentTvl = v1VaultCurrentTvl.get(address.toLowerCase());
          if (currentTvl != null) {
            // We have TVL data but vault wasn't detected as V1 or V2
            // This might be a V1 vault that failed the check, use current TVL
            logger.warn('Vault not detected as V1/V2 but has current TVL, using current TVL', {
              address,
              currentTvl,
            });
            return {
              name: `Vault ${address.slice(0, 6)}...`,
              address: address.toLowerCase(),
              data: [{
                date: new Date().toISOString(),
                value: currentTvl,
              }],
              performanceFee: null,
            };
          }
          // Log for debugging
          logger.debug('Address is neither V1 nor V2 vault', {
            address,
            hasV1Vault: !!v1Result.vault,
            hasCurrentTvl: v1VaultCurrentTvl.has(address.toLowerCase()),
          });
        }
      } catch (error) {
        // Log error for debugging but don't fail the entire request
        logger.warn('Failed to fetch TVL data for vault', {
          address,
          error: error instanceof Error ? error.message : String(error),
        });
        // Try to use current TVL as fallback if available
        const currentTvl = v1VaultCurrentTvl.get(address.toLowerCase());
        if (currentTvl != null) {
          logger.info('Using current TVL as fallback after error', {
            address,
            currentTvl,
          });
          return {
            name: `Vault ${address.slice(0, 6)}...`,
            address: address.toLowerCase(),
            data: [{
              date: new Date().toISOString(),
              value: currentTvl,
            }],
            performanceFee: null,
          };
        }
      }
      return null;
    });

    const tvlByVaultResults = await Promise.all(tvlByVaultPromises);
    
    // Log all results before filtering
    // Extract V2 performance fees before filtering out the performanceFee field
    const v2PerformanceFees = tvlByVaultResults
      .filter((v): v is NonNullable<typeof v> => 
        v !== null && v.performanceFee != null && v.performanceFee !== null)
      .map(v => ({ performanceFee: v.performanceFee as number }));
    
    // Extract TVL data (remove performanceFee field)
    // Include all vaults with at least 1 data point (V1 with historical, V2 with current)
    // For V2 vaults with only 1 data point, create a second point 30 days ago for better chart display
    // V1 vaults with historical data (2+ points) will show trends, V2 vaults will show current value
    
    // Include all vaults with at least 1 data point
    // V2 vaults should have historical data, so they will have multiple data points
    let tvlByVault = tvlByVaultResults
      .filter((v): v is NonNullable<typeof v> => {
        if (!v || v.data.length < 1) {
          if (v) {
            logger.debug('Vault filtered out (no data points)', {
              name: v.name,
              address: v.address,
              dataPoints: v.data.length,
            });
          }
          return false;
        }
        return true;
      })
      .map((v) => {
        // Remove performanceFee field for response (only needed internally for V2 identification)
        // Don't add artificial backfill - let each vault start from its actual first data point
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        const { performanceFee: __performanceFee, ...rest } = v;
        return rest;
      });
    
    // Add V2 vault TVL to totalDeposited
    // V2 vaults are identified by having performanceFee !== null
    const v2VaultTvl = tvlByVaultResults
      .filter((v): v is NonNullable<typeof v> => 
        v !== null && 
        v.performanceFee !== null && 
        v.performanceFee !== undefined
      )
      .reduce((sum, v) => {
        // Get the latest data point (last in array)
        const latestPoint = v.data[v.data.length - 1];
        return sum + (latestPoint?.value ?? 0);
      }, 0);
    totalDeposited += v2VaultTvl;
    
    // Initialize totals (will be updated from DefiLlama if available)
    let totalFeesGenerated = 0;
    let totalInterestGenerated = 0;

    // Unique depositors across our vaults
    const uniqueUsers = new Set<string>();
    for (const p of positions) {
      const userAddress = p.user?.address?.toLowerCase();
      if (userAddress) {
        uniqueUsers.add(userAddress);
      }
    }

    // Fetch DefiLlama data for charts
    let feesTrendDaily: Array<{ date: string; value: number }> = [];
    let feesTrendCumulative: Array<{ date: string; value: number }> = [];
    let revenueTrendDaily: Array<{ date: string; value: number }> = [];
    let revenueTrendCumulative: Array<{ date: string; value: number }> = [];
    let inflowsTrendDaily: Array<{ date: string; value: number }> = [];
    let inflowsTrendCumulative: Array<{ date: string; value: number }> = [];
    let tvlTrend: Array<{ date: string; value: number }> = [];
    
    try {
      // Fetch DefiLlama fees and protocol data in parallel
      const [feesData, protocolData] = await Promise.all([
        fetchDefiLlamaFees(),
        fetchDefiLlamaProtocol(),
      ]);
      
      // Calculate average performance fee rate from all vaults (V1 + V2)
      // Only calculate revenue if we have actual fee data
      let avgPerformanceFeeRate: number | null = null;
      
      // Collect V1 vault performance fees
      const v1FeeRates = morphoVaults
        .map(v => v.state?.fee)
        .filter((f): f is number => f !== null && f !== undefined && f > 0);
      
      // Collect V2 vault performance fees (already collected during TVL fetch)
      const v2FeeRates = v2PerformanceFees
        .map(v => v.performanceFee)
        .filter((f): f is number => f !== null && f !== undefined && f > 0 && !Number.isNaN(f));
      
      // Combine all fee rates
      const allFeeRates = [...v1FeeRates, ...v2FeeRates];
      
      if (allFeeRates.length > 0) {
        avgPerformanceFeeRate = allFeeRates.reduce((a, b) => a + b, 0) / allFeeRates.length;
      }
      
      if (feesData) {
        // Get daily and cumulative fees (interest generated)
        feesTrendDaily = getDailyFeesChart(feesData);
        feesTrendCumulative = getCumulativeFeesChart(feesData);
        
        // Get daily and cumulative revenue (curator fees) - only if we have fee rate
        if (avgPerformanceFeeRate !== null) {
          revenueTrendDaily = getDailyRevenueChart(feesData, avgPerformanceFeeRate);
          revenueTrendCumulative = getCumulativeRevenueChart(feesData, avgPerformanceFeeRate);
        }
        
        // Update totals from DefiLlama
        if (feesData.totalAllTime) {
          totalInterestGenerated = feesData.totalAllTime;
          if (avgPerformanceFeeRate !== null) {
            totalFeesGenerated = feesData.totalAllTime * avgPerformanceFeeRate;
          }
        }
        
        logger.info('DefiLlama fees data loaded', {
          totalAllTime: feesData.totalAllTime,
          chartPointsDaily: feesTrendDaily.length,
          chartPointsCumulative: feesTrendCumulative.length,
        });
      }
      
      if (protocolData) {
        // Get daily and cumulative inflows charts from TVL changes
        // Pass fees data to properly calculate net inflows (excluding performance gains)
        inflowsTrendDaily = getDailyInflowsChart(protocolData, feesData);
        inflowsTrendCumulative = getCumulativeInflowsChart(protocolData, feesData);
        
        logger.info('DefiLlama protocol data loaded', {
          inflowPointsDaily: inflowsTrendDaily.length,
          inflowPointsCumulative: inflowsTrendCumulative.length,
        });
      }
    } catch (error) {
      logger.error('Failed to fetch DefiLlama data', error as Error);
    }
    
    // Aggregate TVL trend from individual vault data (V1 + V2)
    // Combine all vault data points by date and sum values
    // Normalize dates to day-level precision for proper aggregation
    // For each vault, use only the latest value per day to avoid double-counting
    if (tvlByVault.length > 0) {
      const dateMap = new Map<string, number>();
      const dateToOriginalDate = new Map<string, string>(); // normalized -> original ISO
      
      // Helper to normalize date to day-level precision (YYYY-MM-DD)
      const normalizeDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
      };
      
      // For each vault, get the latest value per day (to avoid double-counting)
      // Then aggregate across all vaults
      const vaultDataByDate = new Map<string, Map<string, { value: number; date: string }>>(); // normalizedDate -> vaultName -> {value, date}
      
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
      
      // Now aggregate: sum the latest value from each vault for each date
      vaultDataByDate.forEach((vaultMap, normalizedDate) => {
        let sum = 0;
        let latestDate = '';
        
        vaultMap.forEach(({ value, date }) => {
          sum += value;
          // Track the most recent timestamp for this date
          if (!latestDate || new Date(date) > new Date(latestDate)) {
            latestDate = date;
          }
        });
        
        dateMap.set(normalizedDate, sum);
        dateToOriginalDate.set(normalizedDate, latestDate);
      });
      
      // Convert to array, use original date format, and sort by date
      tvlTrend = Array.from(dateMap.entries())
        .map(([normalizedDate, value]) => ({
          date: dateToOriginalDate.get(normalizedDate) || normalizedDate,
          value,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      logger.info('TVL trend aggregated from vault data', {
        vaults: tvlByVault.length,
        dataPoints: tvlTrend.length,
        totalVaultDataPoints: tvlByVault.reduce((sum, v) => sum + v.data.length, 0),
        sampleDates: tvlTrend.slice(0, 3).map(d => d.date),
        sampleValues: tvlTrend.slice(0, 3).map(d => d.value),
        lastValue: tvlTrend[tvlTrend.length - 1]?.value,
        sumOfLastVaultValues: tvlByVault.reduce((sum, v) => {
          const lastPoint = v.data[v.data.length - 1];
          return sum + (lastPoint?.value || 0);
        }, 0),
      });
    } else {
      // Fallback to placeholder if no vault data
      const now = new Date();
      const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
      tvlTrend = Array.from({ length: 60 }, (_, i) => {
        const date = new Date(sixtyDaysAgo.getTime() + i * (60 * 24 * 60 * 60 * 1000) / 60);
        return { date: date.toISOString(), value: totalDeposited };
      });
      logger.warn('No vault data available, using placeholder TVL trend');
    }

    // Filter all graph data to exclude dates before June 1, 2025
    const MIN_DATE = new Date('2025-06-01T00:00:00.000Z').getTime();
    const filterByMinDate = <T extends { date: string }>(data: T[]): T[] => {
      return data.filter(point => {
        const pointDate = new Date(point.date).getTime();
        return pointDate >= MIN_DATE;
      });
    };

    // Apply filter to all graph data
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
        key: `vault-${v.address}`, // Unique key for each vault (address is unique)
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

    return NextResponse.json(stats, { headers: responseHeaders });
  } catch (err) {
    const { error, statusCode } = handleApiError(err, 'Failed to fetch protocol stats');
    return NextResponse.json(error, { status: statusCode });
  }
}


