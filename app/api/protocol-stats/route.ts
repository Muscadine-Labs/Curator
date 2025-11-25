import { NextResponse } from 'next/server';
import { vaults as configuredVaults } from '@/lib/config/vaults';
import { 
  executeDuneQueryAndWait, 
  getLatestDuneQueryResults,
  type DuneQueryParams 
} from '@/lib/dune/service';
import { 
  BASE_CHAIN_ID, 
  GRAPHQL_FIRST_LIMIT,
  DAYS_30_MS,
  DUNE_QUERY_IDS
} from '@/lib/constants';
import { handleApiError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { gql } from 'graphql-request';
import type { Vault, VaultPosition, Maybe } from '@morpho-org/blue-api-sdk';
import { logger } from '@/lib/utils/logger';

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
    const activeVaults = configuredVaults.length;
    
    // Calculate total fees from Morpho (fallback)
    let totalFeesGenerated = morphoVaults.reduce((sum, v) => sum + (v.state?.fee ?? 0), 0);
    
    // Total interest generated is approximately the fees generated (in a MetaMorpho vault, fees = performance fees from interest)
    // For more accurate calculation, we'd need historical APY data
    const totalInterestGenerated = totalFeesGenerated;

    // Unique depositors across our vaults
    const uniqueUsers = new Set<string>();
    for (const p of positions) {
      const userAddress = p.user?.address?.toLowerCase();
      if (userAddress) {
        uniqueUsers.add(userAddress);
      }
    }

    // Minimal placeholder trends (current TVL as a flat series) to avoid mocks
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - DAYS_30_MS);
    const tvlTrend = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(thirtyDaysAgo.getTime() + i * DAYS_30_MS / 30);
      return { date: date.toISOString(), value: totalDeposited };
    });

    // Try to fetch fees trend from Dune Analytics
    let feesTrend: Array<{ date: string; value: number }> = [];
    let duneTotalFees = totalFeesGenerated;
    
    try {
      if (process.env.DUNE_API_KEY) {
        // Fetch fees data for all active vaults in parallel
        const activeVaults = configuredVaults.filter(v => v.status === 'active');
        
        // Parallelize Dune API calls
        const dunePromises = activeVaults.map(async (vault) => {
          try {
            const vaultParamValue = `${vault.name} - base - ${vault.address}`;
            const params: DuneQueryParams = {
              vault_name_e15077: vaultParamValue,
            };
            
            // Try to get latest results first
            let duneResult = await getLatestDuneQueryResults(DUNE_QUERY_IDS.SINGLE_VAULT_PERFORMANCE, params);
            
            // If no latest results, execute and wait
            if (!duneResult || duneResult.state !== 'QUERY_STATE_COMPLETED') {
              duneResult = await executeDuneQueryAndWait(DUNE_QUERY_IDS.SINGLE_VAULT_PERFORMANCE, params);
            }
            
            return duneResult?.result?.rows || [];
          } catch (error) {
            // Continue with other vaults if one fails
            logger.error(`Error fetching Dune data for vault ${vault.address}`, error as Error, {
              vaultAddress: vault.address,
              vaultName: vault.name,
            });
            return [];
          }
        });
        
        const duneResults = await Promise.all(dunePromises);
        const allRows: Array<Record<string, unknown>> = duneResults.flat();
        
        // Transform Dune results
        if (allRows.length > 0) {
          // Calculate total fees
          duneTotalFees = allRows.reduce((sum, row) => {
            const feeAmount = row.total_fees || row.fees || row.amount || row.fee_amount || 0;
            return sum + (typeof feeAmount === 'number' ? feeAmount : parseFloat(String(feeAmount)) || 0);
          }, 0);
          
          // Create fees trend
          const dailyFees = allRows.reduce((acc: Record<string, number>, row: Record<string, unknown>) => {
            const date = row.date || row.timestamp || row.time || row.block_time;
            const amount = row.total_fees || row.fees || row.amount || row.fee_amount || 0;
            if (date) {
              const dateKey = new Date(String(date)).toISOString().split('T')[0];
              acc[dateKey] = (acc[dateKey] || 0) + (typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0);
            }
            return acc;
          }, {});
          
          feesTrend = Object.entries(dailyFees)
            .map(([date, value]) => ({
              date,
              value: value as number,
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }
        
        // Use Dune total fees if available
        if (duneTotalFees > 0) {
          totalFeesGenerated = duneTotalFees;
        }
      }
    } catch (error) {
      // Silently fail - use empty array if Dune fetch fails
      logger.error('Failed to fetch fees trend from Dune', error as Error);
    }

    const stats = {
      totalDeposited,
      totalFeesGenerated,
      activeVaults,
      totalInterestGenerated,
      users: uniqueUsers.size,
      tvlTrend,
      feesTrend,
    };

    const responseHeaders = new Headers(rateLimitResult.headers);
    responseHeaders.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    return NextResponse.json(stats, { headers: responseHeaders });
  } catch (err) {
    const { error, statusCode } = handleApiError(err, 'Failed to fetch protocol stats');
    return NextResponse.json(error, { status: statusCode });
  }
}


