import { NextResponse } from 'next/server';
import { vaults as configuredVaults } from '@/lib/config/vaults';
import { 
  BASE_CHAIN_ID, 
  GRAPHQL_FIRST_LIMIT,
  getDaysAgoTimestamp
} from '@/lib/constants';
import { handleApiError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { gql } from 'graphql-request';
import type { Vault, VaultPosition, Maybe } from '@morpho-org/blue-api-sdk';
import { logger } from '@/lib/utils/logger';
import { fetchDefiLlamaFees, getFeesChartData } from '@/lib/defillama/service';

// Type-safe response matching our query structure
type ProtocolStatsQueryResponse = {
  vaults: {
    items: Maybe<Vault>[] | null;
  } | null;
  vaultPositions: {
    items: Maybe<VaultPosition>[] | null;
  } | null;
};

type VaultHistoricalQueryResponse = {
  vault: {
    address: string;
    state: {
      totalAssetsUsd: number;
      fee: number; // Performance fee rate (e.g., 0.05 = 5%)
      netApy: number | null;
      apy: number | null;
    } | null;
    historicalState: {
      totalAssetsUsd: Array<{ x: number; y: number }> | null;
    } | null;
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
    const addresses = configuredVaults.map(v => v.address.toLowerCase());

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
    const activeVaultsCount = configuredVaults.length;

    // Unique depositors across our vaults
    const uniqueUsers = new Set<string>();
    for (const p of positions) {
      const userAddress = p.user?.address?.toLowerCase();
      if (userAddress) {
        uniqueUsers.add(userAddress);
      }
    }

    // Fetch historical data for all vaults from Morpho GraphQL
    const historicalOptions = {
      startTimestamp: getDaysAgoTimestamp(30),
      endTimestamp: Math.floor(Date.now() / 1000),
      interval: 'DAY' as const,
    };

    const historicalQuery = gql`
      query VaultHistorical($address: String!, $chainId: Int!, $options: TimeseriesOptions) {
        vault: vaultByAddress(address: $address, chainId: $chainId) {
          address
          state {
            totalAssetsUsd
            fee
            netApy
            apy
          }
          historicalState {
            totalAssetsUsd(options: $options) {
              x
              y
            }
          }
        }
      }
    `;

    // Fetch historical data for all active vaults in parallel
    const activeVaultsList = configuredVaults.filter((v) => v.status === 'active');
    const historicalPromises = activeVaultsList.map(async (vault) => {
      try {
        const data = await morphoGraphQLClient.request<VaultHistoricalQueryResponse>(
          historicalQuery,
          {
            address: vault.address,
            chainId: vault.chainId,
            options: historicalOptions,
          }
        );
        return data.vault;
      } catch (error) {
        logger.error(`Error fetching historical data for vault ${vault.address}`, error as Error, {
          vaultAddress: vault.address,
          vaultName: vault.name,
        });
        return null;
      }
    });

    const historicalResults = await Promise.all(historicalPromises);
    const validHistoricalData = historicalResults.filter((v: typeof historicalResults[0]): v is NonNullable<typeof v> => v !== null);

    // Aggregate TVL trend data
    const tvlByTimestamp: Record<number, number> = {};
    for (const vault of validHistoricalData) {
      const tvlData = vault.historicalState?.totalAssetsUsd;
      if (tvlData && Array.isArray(tvlData)) {
        for (const point of tvlData) {
          const timestamp = point.x;
          const value = point.y || 0;
          tvlByTimestamp[timestamp] = (tvlByTimestamp[timestamp] || 0) + value;
        }
      }
    }

    // Convert to array and sort by date
    const tvlTrend = Object.entries(tvlByTimestamp)
      .map(([timestamp, value]) => ({
        date: new Date(parseInt(timestamp) * 1000).toISOString(),
        value: value as number,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Fetch fees data from DefiLlama (primary source - actual on-chain data)
    // Reference: https://github.com/DefiLlama/dimension-adapters/blob/master/fees/muscadine.ts
    const defiLlamaData = await fetchDefiLlamaFees();
    
    let totalFeesGenerated = 0;
    let totalInterestGenerated = 0;
    let feesTrend: Array<{ date: string; value: number }> = [];

    if (defiLlamaData) {
      // Use DefiLlama data (actual on-chain fees)
      // DefiLlama "Fees" = Total yields from deposited assets (interest generated)
      // DefiLlama methodology: SupplySideRevenue goes to depositors, ProtocolRevenue to curator
      totalInterestGenerated = defiLlamaData.total30d || defiLlamaData.totalAllTime || 0;
      
      // Calculate curator fees (protocol revenue) from total interest
      // Performance fee is typically 5% of interest
      let avgPerformanceFeeRate = 0;
      let feeRateCount = 0;
      for (const vault of validHistoricalData) {
        const feeRate = vault.state?.fee || 0;
        if (feeRate > 0) {
          avgPerformanceFeeRate += feeRate;
          feeRateCount++;
        }
      }
      if (feeRateCount > 0) {
        avgPerformanceFeeRate = avgPerformanceFeeRate / feeRateCount;
      }
      
      totalFeesGenerated = totalInterestGenerated * avgPerformanceFeeRate;
      
      // Get historical fees trend from DefiLlama (they store historical data)
      feesTrend = getFeesChartData(defiLlamaData);
      
      logger.info('Using DefiLlama fees data', {
        total30d: defiLlamaData.total30d,
        totalAllTime: defiLlamaData.totalAllTime,
        chartPoints: feesTrend.length,
      });
    } else {
      // Fallback: Estimate from Morpho APY data
      logger.warn('DefiLlama data unavailable, using Morpho APY estimation');
      
      if (tvlTrend.length >= 2) {
        const startTvl = tvlTrend[0]?.value || 0;
        const endTvl = tvlTrend[tvlTrend.length - 1]?.value || 0;
        
        // Calculate average APY across all vaults (weighted by TVL)
        let weightedApySum = 0;
        let totalWeight = 0;
        for (const vault of validHistoricalData) {
          const tvl = vault.state?.totalAssetsUsd || 0;
          const apy = vault.state?.apy || 0;
          if (tvl > 0 && apy > 0) {
            weightedApySum += apy * tvl;
            totalWeight += tvl;
          }
        }
        const avgApy = totalWeight > 0 ? weightedApySum / totalWeight : 0;
        
        // Estimate 30-day interest
        const avgTvl = (startTvl + endTvl) / 2;
        totalInterestGenerated = avgTvl * (avgApy / 12);
        
        // Calculate fees from interest
        let avgPerformanceFeeRate = 0;
        let feeRateCount = 0;
        for (const vault of validHistoricalData) {
          const feeRate = vault.state?.fee || 0;
          if (feeRate > 0) {
            avgPerformanceFeeRate += feeRate;
            feeRateCount++;
          }
        }
        if (feeRateCount > 0) {
          avgPerformanceFeeRate = avgPerformanceFeeRate / feeRateCount;
          totalFeesGenerated = totalInterestGenerated * avgPerformanceFeeRate;
        }
        
        // Create estimated fees trend
        if (totalInterestGenerated > 0 && avgPerformanceFeeRate > 0) {
          const totalDays = tvlTrend.length;
          const dailyInterestRate = totalInterestGenerated / totalDays / avgTvl;
          
          let cumulativeFees = 0;
          for (const point of tvlTrend) {
            const dailyInterest = point.value * dailyInterestRate;
            const dailyFees = dailyInterest * avgPerformanceFeeRate;
            cumulativeFees += dailyFees;
            feesTrend.push({
              date: point.date,
              value: cumulativeFees,
            });
          }
        }
      }
    }

    const stats = {
      totalDeposited,
      totalFeesGenerated,
      activeVaults: activeVaultsCount,
      totalInterestGenerated,
      users: uniqueUsers.size,
      tvlTrend,
      feesTrend,
      dataSource: defiLlamaData ? 'defillama' : 'morpho-estimated',
    };

    const responseHeaders = new Headers(rateLimitResult.headers);
    responseHeaders.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    return NextResponse.json(stats, { headers: responseHeaders });
  } catch (err) {
    const { error, statusCode } = handleApiError(err, 'Failed to fetch protocol stats');
    return NextResponse.json(error, { status: statusCode });
  }
}


