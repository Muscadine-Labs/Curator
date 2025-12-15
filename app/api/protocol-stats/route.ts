import { NextResponse } from 'next/server';
import { vaultAddresses } from '@/lib/config/vaults';
import { 
  BASE_CHAIN_ID, 
  GRAPHQL_FIRST_LIMIT,
  DAYS_30_MS,
  getDaysAgoTimestamp,
} from '@/lib/constants';
import { shouldUseV2Query } from '@/lib/config/vaults';
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

    const totalDeposited = morphoVaults.reduce((sum, v) => sum + (v.state?.totalAssetsUsd ?? 0), 0);
    const activeVaults = vaultAddresses.length;

    // Fetch historical TVL data per vault (V1 has historical, V2 has current only)
    const tvlByVaultPromises = addresses.map(async (address) => {
      try {
        // First check if it's a V2 vault
        const v2CheckQuery = gql`
          query CheckV2Vault($address: String!, $chainId: Int!) {
            vaultV2ByAddress(address: $address, chainId: $chainId) {
              name
              address
              totalAssetsUsd
            }
          }
        `;
        const v2Result = await morphoGraphQLClient.request<{ vaultV2ByAddress?: { name?: string; address?: string; totalAssetsUsd?: number } | null }>(v2CheckQuery, { address, chainId: BASE_CHAIN_ID });
        
        if (v2Result.vaultV2ByAddress?.name) {
          // This is a V2 vault, use current TVL as a single data point
          const currentDate = new Date().toISOString();
          return {
            name: v2Result.vaultV2ByAddress.name,
            address: address.toLowerCase(),
            data: v2Result.vaultV2ByAddress.totalAssetsUsd != null ? [{
              date: currentDate,
              value: v2Result.vaultV2ByAddress.totalAssetsUsd,
            }] : []
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
        
        if (v1Result.vault?.name && !shouldUseV2Query(v1Result.vault.name)) {
          // This is a V1 vault, fetch historical data
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
              startTimestamp: getDaysAgoTimestamp(30),
              endTimestamp: Math.floor(Date.now() / 1000),
              interval: 'DAY'
            }
          });
          
          if (histResult.vault?.name && histResult.vault?.historicalState?.totalAssetsUsd) {
            return {
              name: histResult.vault.name,
              address: address.toLowerCase(),
              data: histResult.vault.historicalState.totalAssetsUsd.map(point => ({
                date: point.x ? new Date(point.x * 1000).toISOString() : '',
                value: point.y || 0,
              })).filter(p => p.date)
            };
          }
        }
      } catch {
        // Vault not found or error fetching, skip it
      }
      return null;
    });

    const tvlByVaultResults = await Promise.all(tvlByVaultPromises);
    const tvlByVault = tvlByVaultResults.filter((v): v is NonNullable<typeof v> => v !== null);
    
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
      
      // Calculate average performance fee rate from vaults
      let avgPerformanceFeeRate = 0.02; // Default 2%
      const feeRates = morphoVaults
        .map(v => v.state?.fee)
        .filter((f): f is number => f !== null && f !== undefined && f > 0);
      if (feeRates.length > 0) {
        avgPerformanceFeeRate = feeRates.reduce((a, b) => a + b, 0) / feeRates.length;
      }
      
      if (feesData) {
        // Get daily and cumulative fees (interest generated)
        feesTrendDaily = getDailyFeesChart(feesData);
        feesTrendCumulative = getCumulativeFeesChart(feesData);
        
        // Get daily and cumulative revenue (curator fees)
        revenueTrendDaily = getDailyRevenueChart(feesData, avgPerformanceFeeRate);
        revenueTrendCumulative = getCumulativeRevenueChart(feesData, avgPerformanceFeeRate);
        
        // Update totals from DefiLlama
        if (feesData.totalAllTime) {
          totalInterestGenerated = feesData.totalAllTime;
          totalFeesGenerated = feesData.totalAllTime * avgPerformanceFeeRate;
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


