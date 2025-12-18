import { NextResponse } from 'next/server';
import { vaultAddresses } from '@/lib/config/vaults';
import { 
  BASE_CHAIN_ID, 
  GRAPHQL_FIRST_LIMIT,
  DAYS_30_MS,
  getDaysAgoTimestamp,
} from '@/lib/constants';
import { handleApiError } from '@/lib/utils/error-handler';
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

    // Fetch historical TVL data per vault (V1 has historical, V2 has current only)
    // Also collect V2 performance fees for revenue calculation
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
            }
          }
        `;
        const v2Result = await morphoGraphQLClient.request<{ vaultV2ByAddress?: { name?: string; address?: string; performanceFee?: number; totalAssetsUsd?: number } | null }>(v2CheckQuery, { address, chainId: BASE_CHAIN_ID });
        
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
            }
          }
        `;
        const v1Result = await morphoGraphQLClient.request<{ vault?: { name?: string; address?: string } | null }>(v1CheckQuery, { address, chainId: BASE_CHAIN_ID });
        
        logger.info('V1 vault check result', {
          address,
          hasVault: !!v1Result.vault,
          vaultName: v1Result.vault?.name,
        });
        
        // If V2 check returned null/undefined, this is a V1 vault (or doesn't exist)
        // Try to fetch historical data for V1 vaults
        if (v1Result.vault) {
          // This is a V1 vault, fetch historical data
          try {
            const historicalQuery = gql`
              query VaultHistoricalTvl($address: String!, $chainId: Int!, $options: TimeseriesOptions) {
                vault: vaultByAddress(address: $address, chainId: $chainId) {
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
            const histResult = await morphoGraphQLClient.request<{ vault?: { name?: string; address?: string; historicalState?: { totalAssetsUsd?: Array<{ x?: number; y?: number }> } } | null }>(historicalQuery, {
              address,
              chainId: BASE_CHAIN_ID,
              options: {
                startTimestamp: getDaysAgoTimestamp(30), // Start with 30 days, same as DefiLlama range
                endTimestamp: Math.floor(Date.now() / 1000),
                interval: 'DAY'
              }
            });
            
            logger.info('V1 vault historical query result', {
              address,
              hasVault: !!histResult.vault,
              vaultName: histResult.vault?.name,
              hasHistoricalState: !!histResult.vault?.historicalState,
              hasTotalAssetsUsd: !!histResult.vault?.historicalState?.totalAssetsUsd,
              dataPointsCount: histResult.vault?.historicalState?.totalAssetsUsd?.length ?? 0,
              firstPoint: histResult.vault?.historicalState?.totalAssetsUsd?.[0],
            });
            
            if (histResult.vault?.historicalState?.totalAssetsUsd) {
              const dataPoints = histResult.vault.historicalState.totalAssetsUsd.map(point => ({
                date: point.x ? new Date(point.x * 1000).toISOString() : '',
                value: point.y || 0,
              })).filter(p => p.date);
              
              logger.info('V1 vault historical data processed', {
                address,
                name: histResult.vault.name,
                rawDataPoints: histResult.vault.historicalState.totalAssetsUsd.length,
                processedDataPoints: dataPoints.length,
              });
              
              if (dataPoints.length > 0) {
                return {
                  name: histResult.vault.name || `Vault ${address.slice(0, 6)}...`,
                  address: address.toLowerCase(),
                  data: dataPoints,
                  performanceFee: null, // V1 vaults don't contribute performanceFee here (they're already in morphoVaults)
                };
              } else {
                logger.warn('V1 vault historical data filtered out (no valid dates)', {
                  address,
                  name: histResult.vault.name,
                  rawDataPoints: histResult.vault.historicalState.totalAssetsUsd.length,
                });
              }
            } else {
              logger.warn('V1 vault has no historical data', {
                address,
                name: histResult.vault?.name,
                hasHistoricalState: !!histResult.vault?.historicalState,
                hasTotalAssetsUsd: !!histResult.vault?.historicalState?.totalAssetsUsd,
              });
            }
          } catch (histError) {
            logger.warn('Failed to fetch V1 vault historical data', {
              address,
              error: histError instanceof Error ? histError.message : String(histError),
            });
          }
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
    logger.info('TVL by vault results (before filtering)', {
      totalResults: tvlByVaultResults.length,
      results: tvlByVaultResults.map(v => v ? {
        name: v.name,
        address: v.address,
        dataPoints: v.data.length,
        isV2: v.data.length === 1,
      } : null),
    });
    
    // Extract V2 performance fees before filtering out the performanceFee field
    const v2PerformanceFees = tvlByVaultResults
      .filter((v): v is { name: string; address: string; data: Array<{ date: string; value: number }>; performanceFee: number | null } => 
        v !== null && v.performanceFee != null && v.performanceFee !== null)
      .map(v => ({ performanceFee: v.performanceFee as number }));
    
    // Extract TVL data (remove performanceFee field)
    // Filter to only include V1 vaults (those with historical data, data.length >= 2)
    // V2 vaults only have 1 data point (current TVL) so they're excluded from "By Vault" view
    const tvlByVault = tvlByVaultResults
      .filter((v): v is NonNullable<typeof v> => v !== null && v.data.length >= 2)
      .map(({ performanceFee: _performanceFee, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars
    
    // Add V2 vault TVL to totalDeposited (V2 vaults have data.length === 1)
    const v2VaultTvl = tvlByVaultResults
      .filter((v): v is NonNullable<typeof v> => v !== null && v.data.length === 1)
      .reduce((sum, v) => sum + (v.data[0]?.value ?? 0), 0);
    totalDeposited += v2VaultTvl;
    
    // Log vault data for debugging
    logger.info('TVL by vault data fetched', {
      totalResults: tvlByVaultResults.length,
      nonNullResults: tvlByVaultResults.filter(v => v !== null).length,
      v1Vaults: tvlByVaultResults.filter(v => v !== null && v.data.length >= 2).length,
      v2Vaults: tvlByVaultResults.filter(v => v !== null && v.data.length === 1).length,
      finalTvlByVaultCount: tvlByVault.length,
      vaults: tvlByVault.map(v => ({
        name: v.name,
        dataPoints: v.data.length,
        dateRange: v.data.length > 0 ? {
          first: v.data[0].date,
          last: v.data[v.data.length - 1].date,
        } : null,
      })),
    });
    
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


