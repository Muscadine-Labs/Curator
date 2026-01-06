import { NextResponse } from 'next/server';
import { vaultAddresses } from '@/lib/config/vaults';
import { 
  BASE_CHAIN_ID, 
  GRAPHQL_FIRST_LIMIT,
  getDaysAgoTimestamp,
} from '@/lib/constants';
import { handleApiError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { gql } from 'graphql-request';
import { getAddress } from 'viem';
import { logger } from '@/lib/utils/logger';
import { 
  fetchDefiLlamaFees,
  fetchDefiLlamaProtocol,
  getDailyInflowsChart,
} from '@/lib/defillama/service';

// Ensure Node.js runtime for API routes
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vault address to asset mapping
const VAULT_ASSET_MAP: Record<string, 'USDC' | 'cbBTC' | 'WETH'> = {
  '0xf7e26fa48a568b8b0038e104dfd8abdf0f99074f': 'USDC', // V1 USDC
  '0x89712980cb434ef5ae4ab29349419eb976b0b496': 'USDC', // V2 USDC Prime
  '0xaecc8113a7bd0cfaf7000ea7a31affd4691ff3e9': 'cbBTC', // V1 cbBTC
  '0x99dcd0d75822ba398f13b2a8852b07c7e137ec70': 'cbBTC', // V2 cbBTC Prime
  '0x21e0d366272798da3a977feba699fcb91959d120': 'WETH', // V1 WETH
  '0xd6dcad2f7da91fbb27bda471540d9770c97a5a43': 'WETH', // V2 WETH Prime
};

// Start date for monthly statements
const STATEMENT_START_DATE = new Date('2025-10-01T00:00:00Z');

interface MonthlyStatementData {
  month: string; // YYYY-MM format
  assets: {
    USDC: number;
    cbBTC: number;
    WETH: number;
  };
  total: number;
  isComplete: boolean; // Whether the month is complete (past the last day)
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
    const addresses = vaultAddresses.map(v => getAddress(v.address));

    // Fetch V1 vault data
    const v1Query = gql`
      query FetchV1VaultsForMonthlyStatement($addresses: [String!]) {
        vaults(
          first: ${GRAPHQL_FIRST_LIMIT}
          where: { address_in: $addresses, chainId_in: [${BASE_CHAIN_ID}] }
        ) {
          items {
            address
            asset { symbol }
            state { 
              totalAssetsUsd
              fee
            }
          }
        }
      }
    `;

    const v1VaultData = await morphoGraphQLClient.request<{
      vaults?: {
        items: Array<{
          address?: string | null;
          asset?: { symbol?: string | null } | null;
          state?: { totalAssetsUsd?: number | null; fee?: number | null } | null;
        } | null>;
      } | null;
    }>(v1Query, { addresses });

    // Fetch V2 vaults individually (no batch query available)
    const v2VaultPromises = addresses.map(async (address) => {
      try {
        const v2Query = gql`
          query FetchV2VaultForMonthlyStatement($address: String!, $chainId: Int!) {
            vaultV2ByAddress(address: $address, chainId: $chainId) {
              address
              asset { symbol }
              performanceFee
              totalAssetsUsd
            }
          }
        `;
        const result = await morphoGraphQLClient.request<{
          vaultV2ByAddress?: {
            address?: string | null;
            asset?: { symbol?: string | null } | null;
            performanceFee?: number | null;
            totalAssetsUsd?: number | null;
          } | null;
        }>(v2Query, { address, chainId: BASE_CHAIN_ID });
        return result.vaultV2ByAddress;
      } catch (error) {
        logger.warn('Failed to fetch V2 vault', {
          address,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    });

    const v2VaultResults = await Promise.all(v2VaultPromises);

    // Create a map of vault address to asset and performance fee
    const vaultInfoMap = new Map<string, { asset: string; performanceFee: number; tvl: number }>();
    
    // Process V1 vaults
    const v1Vaults = v1VaultData.vaults?.items?.filter((v): v is NonNullable<typeof v> => v !== null) ?? [];
    v1Vaults.forEach(v => {
      if (v.address && v.asset?.symbol) {
        const addr = v.address.toLowerCase();
        const asset = v.asset.symbol.toUpperCase();
        const performanceFee = v.state?.fee ?? 0;
        const tvl = v.state?.totalAssetsUsd ?? 0;
        vaultInfoMap.set(addr, { asset, performanceFee, tvl });
      }
    });

    // Process V2 vaults
    v2VaultResults.forEach(v => {
      if (v && v.address && v.asset?.symbol) {
        const addr = v.address.toLowerCase();
        const asset = v.asset.symbol.toUpperCase();
        const performanceFee = v.performanceFee ?? 0;
        const tvl = v.totalAssetsUsd ?? 0;
        vaultInfoMap.set(addr, { asset, performanceFee, tvl });
      }
    });

    // Fetch DefiLlama fees data (interest generated)
    let feesData = null;
    try {
      feesData = await fetchDefiLlamaFees();
    } catch (error) {
      logger.warn('Failed to fetch DefiLlama fees data', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Fetch DefiLlama protocol data for TVL history
    let protocolData = null;
    try {
      protocolData = await fetchDefiLlamaProtocol();
    } catch (error) {
      logger.warn('Failed to fetch DefiLlama protocol data', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Get historical TVL data per vault from GraphQL
    const startTimestamp = Math.floor(STATEMENT_START_DATE.getTime() / 1000);
    const endTimestamp = Math.floor(Date.now() / 1000);

    const tvlHistoryPromises = addresses.map(async (address) => {
      try {
        const addr = address.toLowerCase();
        const vaultInfo = vaultInfoMap.get(addr);
        if (!vaultInfo) return null;

        // Try V1 vault first - get both totalAssets and totalSupply for exchange rate calculation
        const v1Query = gql`
          query VaultHistoricalData($address: String!, $chainId: Int!, $options: TimeseriesOptions) {
            vault: vaultByAddress(address: $address, chainId: $chainId) {
              address
              asset { symbol decimals }
              historicalState {
                totalAssets(options: $options) {
                  x
                  y
                }
                totalAssetsUsd(options: $options) {
                  x
                  y
                }
              }
            }
          }
        `;

        const v1Result = await morphoGraphQLClient.request<{
          vault?: {
            address?: string | null;
            asset?: { symbol?: string | null; decimals?: number | null } | null;
            historicalState?: {
              totalAssets?: Array<{ x?: number; y?: number }> | null;
              totalAssetsUsd?: Array<{ x?: number; y?: number }> | null;
            } | null;
          } | null;
        }>(v1Query, {
          address,
          chainId: BASE_CHAIN_ID,
          options: {
            startTimestamp,
            endTimestamp,
            interval: 'DAY',
          },
        });

        if (v1Result.vault?.historicalState?.totalAssets && v1Result.vault.historicalState.totalAssetsUsd) {
          // Map totalAssets and totalAssetsUsd by timestamp
          const assetsMap = new Map<number, number>();
          const assetsUsdMap = new Map<number, number>();
          
          v1Result.vault.historicalState.totalAssets.forEach(point => {
            if (point.x) assetsMap.set(point.x, point.y || 0);
          });
          
          v1Result.vault.historicalState.totalAssetsUsd.forEach(point => {
            if (point.x) assetsUsdMap.set(point.x, point.y || 0);
          });
          
          // Combine data points
          const allTimestamps = new Set([...assetsMap.keys(), ...assetsUsdMap.keys()]);
          const data = Array.from(allTimestamps)
            .sort((a, b) => a - b)
            .map(timestamp => ({
              date: new Date(timestamp * 1000).toISOString(),
              totalAssets: assetsMap.get(timestamp) || 0,
              totalAssetsUsd: assetsUsdMap.get(timestamp) || 0,
            }))
            .filter(p => p.date);
          
          return {
            address: addr,
            asset: vaultInfo.asset,
            assetDecimals: v1Result.vault.asset?.decimals || 18,
            data,
            isV1: true,
          };
        }

        // Try V2 vault - get both totalAssets and totalAssetsUsd
        const v2Query = gql`
          query VaultV2HistoricalData($address: String!, $chainId: Int!, $options: TimeseriesOptions) {
            vaultV2ByAddress(address: $address, chainId: $chainId) {
              address
              asset { symbol decimals }
              historicalState {
                totalAssetsUsd(options: $options) {
                  x
                  y
                }
              }
            }
          }
        `;

        const v2Result = await morphoGraphQLClient.request<{
          vaultV2ByAddress?: {
            address?: string | null;
            asset?: { symbol?: string | null; decimals?: number | null } | null;
            historicalState?: {
              totalAssetsUsd?: Array<{ x?: number; y?: number }> | null;
            } | null;
          } | null;
        }>(v2Query, {
          address,
          chainId: BASE_CHAIN_ID,
          options: {
            startTimestamp,
            endTimestamp,
            interval: 'DAY',
          },
        });

        if (v2Result.vaultV2ByAddress?.historicalState?.totalAssetsUsd) {
          const data = v2Result.vaultV2ByAddress.historicalState.totalAssetsUsd.map(point => ({
            date: point.x ? new Date(point.x * 1000).toISOString() : '',
            totalAssets: 0, // V2 doesn't have totalAssets in historicalState, will need to query on-chain
            totalAssetsUsd: point.y || 0,
          })).filter(p => p.date);
          
          return {
            address: addr,
            asset: vaultInfo.asset,
            assetDecimals: v2Result.vaultV2ByAddress.asset?.decimals || 18,
            data,
            isV1: false,
          };
        }

        return null;
      } catch (error) {
        logger.warn('Failed to fetch TVL history for vault', {
          address,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    });

    const tvlHistories = await Promise.all(tvlHistoryPromises);
    const validTvlHistories = tvlHistories.filter((h): h is NonNullable<typeof h> => h !== null);

    if (validTvlHistories.length === 0) {
      return NextResponse.json({ statements: [] });
    }

    // Get daily inflows data to account for deposits/withdrawals
    let dailyInflows: Array<{ date: string; value: number }> = [];
    if (protocolData && feesData) {
      dailyInflows = getDailyInflowsChart(protocolData, feesData);
    }

    // Create a map of date -> inflows (negative = outflows)
    const inflowsByDate = new Map<string, number>();
    dailyInflows.forEach(inflow => {
      const date = new Date(inflow.date);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString();
      inflowsByDate.set(dateKey, inflow.value);
    });

    // Create a map of date -> vault address -> { totalAssets, totalAssetsUsd }
    const vaultDataByDate = new Map<string, Map<string, { totalAssets: number; totalAssetsUsd: number }>>();

    validTvlHistories.forEach(history => {
      history.data.forEach((point: any) => {
        const date = new Date(point.date);
        date.setHours(0, 0, 0, 0);
        const dateKey = date.toISOString();
        
        if (!vaultDataByDate.has(dateKey)) {
          vaultDataByDate.set(dateKey, new Map());
        }
        
        const vaultMap = vaultDataByDate.get(dateKey)!;
        // Handle both old format (value) and new format (totalAssets, totalAssetsUsd)
        const totalAssets = point.totalAssets !== undefined ? point.totalAssets : 0;
        const totalAssetsUsd = point.totalAssetsUsd !== undefined ? point.totalAssetsUsd : (point.value || 0);
        
        vaultMap.set(history.address, {
          totalAssets,
          totalAssetsUsd,
        });
      });
    });

    // Calculate daily interest per vault, then apply performance fee to get revenue
    // Interest = change in totalAssets - inflows (similar to DefiLlama approach)
    const dailyInterestByVault = new Map<string, Map<string, number>>(); // date -> vault -> interest
    const dailyRevenueByAsset: Array<{
      date: string;
      USDC: number;
      cbBTC: number;
      WETH: number;
    }> = [];

    // Sort dates to process chronologically
    const sortedDates = Array.from(vaultDataByDate.keys()).sort();

    for (let i = 1; i < sortedDates.length; i++) {
      const currentDateKey = sortedDates[i];
      const prevDateKey = sortedDates[i - 1];
      
      const currentDate = new Date(currentDateKey);
      currentDate.setHours(0, 0, 0, 0);
      
      // Only process dates from October 1st, 2025 onwards
      if (currentDate < STATEMENT_START_DATE) {
        continue;
      }

      const currentVaultMap = vaultDataByDate.get(currentDateKey) || new Map();
      const prevVaultMap = vaultDataByDate.get(prevDateKey) || new Map();
      
      // Get total inflows for this date (aggregate across all vaults)
      const totalInflows = inflowsByDate.get(currentDateKey) || 0;
      const totalTvl = Array.from(currentVaultMap.values()).reduce((sum, v) => sum + v.totalAssetsUsd, 0);

      // Calculate interest per vault
      const vaultInterestMap = new Map<string, number>();
      let totalVaultInterest = 0;

      currentVaultMap.forEach((currentData, vaultAddress) => {
        const vaultInfo = vaultInfoMap.get(vaultAddress);
        if (!vaultInfo) return;

        const prevData = prevVaultMap.get(vaultAddress);
        if (!prevData) return;

        // Calculate change in totalAssets (USD)
        const tvlChange = currentData.totalAssetsUsd - prevData.totalAssetsUsd;
        
        // Split inflows proportionally by vault TVL
        const vaultInflows = totalTvl > 0 ? (totalInflows * (currentData.totalAssetsUsd / totalTvl)) : 0;
        
        // Daily interest = TVL change - inflows (interest earned, excluding deposits/withdrawals)
        const vaultDailyInterest = tvlChange - vaultInflows;
        
        // Only count positive interest (earned)
        if (vaultDailyInterest > 0) {
          vaultInterestMap.set(vaultAddress, vaultDailyInterest);
          totalVaultInterest += vaultDailyInterest;
        }
      });

      // Store interest by vault for this date
      if (!dailyInterestByVault.has(currentDateKey)) {
        dailyInterestByVault.set(currentDateKey, new Map());
      }
      vaultInterestMap.forEach((interest, vaultAddress) => {
        dailyInterestByVault.get(currentDateKey)!.set(vaultAddress, interest);
      });

      // Get DefiLlama daily fees for this date (aggregate interest for all vaults)
      const defiLlamaDailyFees = feesData?.totalDataChart?.find(([timestamp]) => {
        const date = new Date(timestamp * 1000);
        date.setHours(0, 0, 0, 0);
        return date.toISOString() === currentDateKey;
      })?.[1] || 0;

      // Skip if we can't calculate vault interest (need at least one vault with data)
      if (totalVaultInterest <= 0) {
        continue;
      }

      // Use DefiLlama's aggregate fees when available, otherwise use calculated total
      // This ensures we match DefiLlama's totals exactly when data is available
      const dailyFeesToUse = defiLlamaDailyFees > 0 ? defiLlamaDailyFees : totalVaultInterest;
      const scaleFactor = totalVaultInterest > 0 
        ? dailyFeesToUse / totalVaultInterest 
        : 0;

      // If scaling fails, skip this date
      if (scaleFactor === 0 || !isFinite(scaleFactor)) {
        continue;
      }

      let usdcRevenue = 0;
      let cbbtcRevenue = 0;
      let wethRevenue = 0;

      vaultInterestMap.forEach((interest, vaultAddress) => {
        const vaultInfo = vaultInfoMap.get(vaultAddress);
        if (!vaultInfo) return;

        // Scale interest to match DefiLlama aggregate, then apply performance fee
        const scaledInterest = interest * scaleFactor;
        const vaultDailyRevenue = scaledInterest * vaultInfo.performanceFee;

        // Aggregate by asset
        const normalizedAsset = vaultInfo.asset.toUpperCase();
        if (normalizedAsset === 'USDC') {
          usdcRevenue += vaultDailyRevenue;
        } else if (normalizedAsset === 'CBBTC') {
          cbbtcRevenue += vaultDailyRevenue;
        } else if (normalizedAsset === 'WETH') {
          wethRevenue += vaultDailyRevenue;
        }
      });

      dailyRevenueByAsset.push({
        date: currentDateKey,
        USDC: usdcRevenue,
        cbBTC: cbbtcRevenue,
        WETH: wethRevenue,
      });
    }

    // Group by month
    const monthlyStatements = new Map<string, { USDC: number; cbBTC: number; WETH: number }>();

    dailyRevenueByAsset.forEach(day => {
      const date = new Date(day.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyStatements.has(monthKey)) {
        monthlyStatements.set(monthKey, { USDC: 0, cbBTC: 0, WETH: 0 });
      }
      
      const monthData = monthlyStatements.get(monthKey)!;
      monthData.USDC += day.USDC;
      monthData.cbBTC += day.cbBTC;
      monthData.WETH += day.WETH;
    });

    // Convert to array format and sort by month
    const now = new Date();
    now.setHours(23, 59, 59, 999); // End of today

    const statements: MonthlyStatementData[] = Array.from(monthlyStatements.entries())
      .map(([month, assets]) => {
        // Parse the month string (YYYY-MM)
        const [year, monthNum] = month.split('-').map(Number);
        
        // Get the last day of this month (day 0 of next month)
        const lastDayOfMonth = new Date(year, monthNum, 0);
        lastDayOfMonth.setHours(23, 59, 59, 999);
        
        // Month is complete if current date is past the last day of that month
        const isComplete = now > lastDayOfMonth;
        
        return {
          month,
          assets,
          total: assets.USDC + assets.cbBTC + assets.WETH,
          isComplete,
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    const responseHeaders = new Headers(rateLimitResult.headers);
    responseHeaders.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    return NextResponse.json({ statements }, { headers: responseHeaders });
  } catch (err) {
    const { error, statusCode } = handleApiError(err, 'Failed to fetch monthly statement');
    return NextResponse.json(error, { status: statusCode });
  }
}

