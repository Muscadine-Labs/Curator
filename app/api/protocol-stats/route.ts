import { NextResponse } from 'next/server';
import { vaultAddresses } from '@/lib/config/vaults';
import { 
  BASE_CHAIN_ID, 
  GRAPHQL_FIRST_LIMIT,
  DAYS_30_MS,
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
  getCumulativeFeesChart,
  getCumulativeRevenueChart,
  getInflowsChart 
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
    let feesTrend: Array<{ date: string; value: number }> = [];
    let revenueTrend: Array<{ date: string; value: number }> = [];
    let inflowsTrend: Array<{ date: string; value: number }> = [];
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
        // Get cumulative fees (interest generated)
        feesTrend = getCumulativeFeesChart(feesData);
        
        // Get cumulative revenue (curator fees)
        revenueTrend = getCumulativeRevenueChart(feesData, avgPerformanceFeeRate);
        
        // Update totals from DefiLlama
        if (feesData.totalAllTime) {
          totalInterestGenerated = feesData.totalAllTime;
          totalFeesGenerated = feesData.totalAllTime * avgPerformanceFeeRate;
        }
        
        logger.info('DefiLlama fees data loaded', {
          totalAllTime: feesData.totalAllTime,
          chartPoints: feesTrend.length,
        });
      }
      
      if (protocolData) {
        // Get inflows chart from TVL changes
        inflowsTrend = getInflowsChart(protocolData);
        
        // Get TVL trend from DefiLlama
        if (protocolData.tvl && protocolData.tvl.length > 0) {
          tvlTrend = protocolData.tvl.map(point => ({
            date: new Date(point.date * 1000).toISOString(),
            value: point.totalLiquidityUSD,
          }));
        }
        
        logger.info('DefiLlama protocol data loaded', {
          tvlPoints: tvlTrend.length,
          inflowPoints: inflowsTrend.length,
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
      feesTrend,
      revenueTrend,
      inflowsTrend,
    };

    const responseHeaders = new Headers(rateLimitResult.headers);
    responseHeaders.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    return NextResponse.json(stats, { headers: responseHeaders });
  } catch (err) {
    const { error, statusCode } = handleApiError(err, 'Failed to fetch protocol stats');
    return NextResponse.json(error, { status: statusCode });
  }
}


