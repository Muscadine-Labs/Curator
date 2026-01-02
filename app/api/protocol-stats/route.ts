import { NextResponse } from 'next/server';
import { vaultAddresses } from '@/lib/config/vaults';
import { 
  BASE_CHAIN_ID, 
  GRAPHQL_FIRST_LIMIT,
  DAYS_30_MS,
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
        const v2Result = await morphoGraphQLClient.request<{ vaultV2ByAddress?: { name?: string; address?: string; performanceFee?: number; totalAssetsUsd?: number; asset?: { symbol?: string; address?: string } | null } | null }>(v2CheckQuery, { address, chainId: BASE_CHAIN_ID });
        
        // Check if V2 vault exists (not null/undefined), even if name is missing
        if (v2Result.vaultV2ByAddress !== null && v2Result.vaultV2ByAddress !== undefined) {
          // This is a V2 vault, use current TVL as a single data point
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
            const histResult = await morphoGraphQLClient.request<{ vault?: { name?: string; address?: string; asset?: { symbol?: string; address?: string } | null; historicalState?: { totalAssetsUsd?: Array<{ x?: number; y?: number }> } } | null }>(historicalQuery, {
              address,
              chainId: BASE_CHAIN_ID,
              options: {
                startTimestamp: getDaysAgoTimestamp(30), // 30 days of historical data
                endTimestamp: Math.floor(Date.now() / 1000),
                interval: 'DAY'
              }
            });
            
            if (histResult.vault?.historicalState?.totalAssetsUsd) {
              const rawDataPoints = histResult.vault.historicalState.totalAssetsUsd;
              
              logger.info('V1 vault historical data fetched', {
                address,
                name: histResult.vault.name || v1Result.vault?.name || 'Unknown',
                rawDataPoints: rawDataPoints.length,
              });
              
              const dataPoints = rawDataPoints.map(point => ({
                date: point.x ? new Date(point.x * 1000).toISOString() : '',
                value: point.y || 0,
              })).filter(p => p.date);
              
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
              } else {
                logger.warn('V1 vault has no valid data points after processing', {
                  address,
                  name: histResult.vault?.name || v1Result.vault?.name || 'Unknown',
                  rawDataPoints: rawDataPoints.length,
                });
                // Fallback to current TVL if available
                if (currentTvl != null) {
                  const vaultName = histResult.vault?.name || v1Result.vault?.name || `Vault ${address.slice(0, 6)}...`;
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
              logger.warn('V1 vault has no historicalState data', {
                address,
                name: v1Result.vault?.name || histResult.vault?.name || 'Unknown',
                hasVaultFromCheck: !!v1Result.vault,
                hasVaultFromHist: !!histResult.vault,
                hasHistoricalState: !!histResult.vault?.historicalState,
                hasTotalAssetsUsd: !!histResult.vault?.historicalState?.totalAssetsUsd,
              });
              // No historical data, but try to use current TVL if available
              if (currentTvl != null) {
                const vaultName = v1Result.vault?.name || histResult.vault?.name || `Vault ${address.slice(0, 6)}...`;
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
                name: v1Result.vault?.name || histResult.vault?.name || 'Unknown',
              });
            }
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
          // Not a V1 vault and not a V2 vault - log for debugging
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
    // For V2 vaults with only 1 point, create a second point 30 days ago for better chart display
    const tvlByVault = tvlByVaultResults
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
        // For V2 vaults with only 1 data point, add a second point 30 days ago for better chart visualization
        if (v.data.length === 1 && v.performanceFee !== null && v.performanceFee !== undefined) {
          const currentPoint = v.data[0];
          const thirtyDaysAgo = new Date(new Date(currentPoint.date).getTime() - (30 * 24 * 60 * 60 * 1000));
          return {
            name: v.name,
            address: v.address,
            data: [
              {
                date: thirtyDaysAgo.toISOString(),
                value: currentPoint.value, // Use same value for flat line
              },
              currentPoint,
            ],
          };
        }
        // Remove performanceFee field for response (only needed internally for V2 identification)
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
        
        // Get TVL trend from DefiLlama
        if (protocolData.tvl && protocolData.tvl.length > 0) {
          tvlTrend = protocolData.tvl.map(point => ({
            date: new Date(point.date * 1000).toISOString(),
            value: point.totalLiquidityUSD,
          }));
        }
        
        logger.info('DefiLlama protocol data loaded', {
          tvlPoints: tvlTrend.length,
          inflowPointsDaily: inflowsTrendDaily.length,
          inflowPointsCumulative: inflowsTrendCumulative.length,
        });
      }
    } catch (error) {
      logger.error('Failed to fetch DefiLlama data', error as Error);
    }
    
    // Fallback to placeholder if no DefiLlama data
    if (tvlTrend.length === 0) {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - DAYS_30_MS);
      tvlTrend = Array.from({ length: 30 }, (_, i) => {
        const date = new Date(thirtyDaysAgo.getTime() + i * DAYS_30_MS / 30);
        return { date: date.toISOString(), value: totalDeposited };
      });
    }

    const stats = {
      totalDeposited,
      totalFeesGenerated,
      activeVaults,
      totalInterestGenerated,
      users: uniqueUsers.size,
      tvlTrend,
      tvlByVault: tvlByVault.map(v => ({
        name: v.name,
        address: v.address,
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


