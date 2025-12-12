import { NextRequest, NextResponse } from 'next/server';
import { getVaultByAddress, shouldUseV2Query } from '@/lib/config/vaults';
import { GRAPHQL_FIRST_LIMIT, GRAPHQL_TRANSACTIONS_LIMIT, getDaysAgoTimestamp } from '@/lib/constants';
import { handleApiError, AppError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { gql } from 'graphql-request';
import { getAddress, isAddress } from 'viem';
// Types imported from SDK but not directly used in this file
// import type { Vault, VaultPosition, Maybe } from '@morpho-org/blue-api-sdk';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;
    
    // Check if id is a valid address
    let address: string;
    if (isAddress(id)) {
      address = getAddress(id);
    } else {
      // Try to find by address in config
      const cfg = getVaultByAddress(id);
      if (!cfg) {
        throw new AppError('Vault not found', 404, 'VAULT_NOT_FOUND');
      }
      address = getAddress(cfg.address);
    }

    // Check if address is in our configured list
    const cfg = getVaultByAddress(address);
    if (!cfg) {
      throw new AppError('Vault not found in configuration', 404, 'VAULT_NOT_FOUND');
    }

    // Try to fetch vault name first to determine query type
    // We'll try V2 first, then V1 if V2 fails
    let vaultName: string | null = null;
    let isV2 = false;
    
    try {
      const v2CheckQuery = gql`
        query CheckV2Vault($address: String!, $chainId: Int!) {
          vaultV2ByAddress(address: $address, chainId: $chainId) {
            name
          }
        }
      `;
      const v2Check = await morphoGraphQLClient.request<{ vaultV2ByAddress?: { name?: string } | null }>(v2CheckQuery, { address, chainId: cfg.chainId });
      if (v2Check.vaultV2ByAddress?.name) {
        vaultName = v2Check.vaultV2ByAddress.name;
        isV2 = true;
      }
    } catch {
      // V2 query failed, try V1
      try {
        const v1CheckQuery = gql`
          query CheckV1Vault($address: String!, $chainId: Int!) {
            vault: vaultByAddress(address: $address, chainId: $chainId) {
              name
            }
          }
        `;
        const v1Check = await morphoGraphQLClient.request<{ vault?: { name?: string } | null }>(v1CheckQuery, { address, chainId: cfg.chainId });
        if (v1Check.vault?.name) {
          vaultName = v1Check.vault.name;
          isV2 = false;
        }
      } catch {
        throw new AppError('Vault not found in GraphQL', 404, 'VAULT_NOT_FOUND');
      }
    }

    // If we couldn't determine from GraphQL, use the name-based check
    if (!vaultName) {
      // Fallback: try V2 query based on address pattern or default to V1
      isV2 = false;
    } else {
      // Use the vault name to determine query type
      isV2 = shouldUseV2Query(vaultName);
    }

    // V2 vaults don't need options for historical data
    const variables = isV2
      ? {
          address,
          chainId: cfg.chainId,
        }
      : {
          address,
          chainId: cfg.chainId,
          options: {
            startTimestamp: getDaysAgoTimestamp(30),
            endTimestamp: Math.floor(Date.now() / 1000),
            interval: 'DAY'
          }
        };

    // Response type - complex nested structure from GraphQL
    // Using unknown for vault since it has deeply nested structure that matches our query
    // V2 uses vaultV2ByAddress, V1 uses vaultByAddress
    type VaultDetailQueryResponse = {
      vault?: unknown;
      vaultV2ByAddress?: unknown;
      positions?: {
        items: Array<{ user: { address: string } } | null> | null;
      } | null;
      txs?: {
        items: Array<{
          blockNumber: number;
          hash: string;
          type: string;
          user?: { address?: string | null } | null;
        } | null> | null;
      } | null;
    };
    
    const v1Query = gql`
      query VaultDetail($address: String!, $chainId: Int!, $options: TimeseriesOptions) {
        vault: vaultByAddress(address: $address, chainId: $chainId) {
          address
          name
          symbol
          whitelisted
          metadata {
            description
            forumLink
            image
            curators { image name url }
          }
          allocators { address }
          asset { address decimals yield { apr } }
          state {
            owner
            curator
            guardian
            timelock
            totalAssets
            totalAssetsUsd
            totalSupply
            apy
            netApy
            netApyWithoutRewards
            avgApy
            avgNetApy
            dailyApy
            dailyNetApy
            weeklyApy
            weeklyNetApy
            monthlyApy
            monthlyNetApy
            fee
            rewards {
              asset { address chain { id } }
              supplyApr
              yearlySupplyTokens
            }
            allocation {
              supplyAssets
              supplyAssetsUsd
              supplyCap
              market {
                uniqueKey
                loanAsset { name }
                collateralAsset { name }
                oracleAddress
                irmAddress
                lltv
                state {
                  rewards {
                    asset { address chain { id } }
                    supplyApr
                    borrowApr
                  }
                }
              }
            }
            lastTotalAssets
            allocationQueues: allocation {
              supplyQueueIndex
              withdrawQueueIndex
              market { uniqueKey }
            }
          }
          historicalState {
            apy(options: $options) {
              x
              y
            }
            netApy(options: $options) {
              x
              y
            }
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
        positions: vaultPositions(
          first: ${GRAPHQL_FIRST_LIMIT},
          where: { vaultAddress_in: [$address] }
        ) { items { user { address } } }
        txs: transactions(
          first: ${GRAPHQL_TRANSACTIONS_LIMIT},
          orderBy: Timestamp,
          orderDirection: Desc,
          where: { vaultAddress_in: [$address] }
        ) {
          items { blockNumber hash type user { address } }
        }
      }
    `;

    const v2Query = gql`
      query VaultV2Detail($address: String!, $chainId: Int!) {
        vaultV2ByAddress(address: $address, chainId: $chainId) {
          address
          name
          symbol
          whitelisted
          metadata {
            description
            forumLink
            image
            curators { image name url }
          }
          asset { address symbol decimals }
          curator { address }
          owner { address }
          totalAssets
          totalAssetsUsd
          totalSupply
          performanceFee
          managementFee
          maxApy
          avgApy
          avgNetApy
          rewards {
            asset { address chain { id } }
            supplyApr
            yearlySupplyTokens
          }
          positions(first: ${GRAPHQL_FIRST_LIMIT}) {
            items { user { address } }
          }
        }
        txs: transactions(
          first: ${GRAPHQL_TRANSACTIONS_LIMIT},
          orderBy: Timestamp,
          orderDirection: Desc,
          where: { vaultAddress_in: [$address] }
        ) {
          items { blockNumber hash type user { address } }
        }
      }
    `;

    const query = isV2 ? v2Query : v1Query;

    let data: VaultDetailQueryResponse;
    try {
      data = await morphoGraphQLClient.request<VaultDetailQueryResponse>(
        query,
        variables
      );
      // Debug logging for v2 vaults
      if (isV2 && data.vaultV2ByAddress) {
        const vaultData = data.vaultV2ByAddress as Record<string, unknown>;
        console.log(`V2 vault query successful for ${cfg.address}:`, {
          hasVaultV2ByAddress: !!data.vaultV2ByAddress,
          totalAssetsUsd: vaultData?.totalAssetsUsd,
          totalAssets: vaultData?.totalAssets,
          address: vaultData?.address,
        });
      }
    } catch (graphqlError) {
      // For v2 vaults, GraphQL API may not have indexed them yet
      // Check if this is a v2 vault and handle gracefully
      if (isV2) {
        console.error(`GraphQL query failed for v2 vault ${address}:`, graphqlError);
        // Return null vault to trigger fallback handling below
        data = { vaultV2ByAddress: null, positions: null, txs: null };
      } else {
        // For v1 vaults, re-throw the error
        throw graphqlError;
      }
    }

    // If vault not found in Morpho (v2 vaults may not be indexed yet)
    // V2 uses vaultV2ByAddress, V1 uses vault
    const vaultData = isV2 ? data.vaultV2ByAddress : data.vault;
    if (!vaultData && isV2) {
      // Log for debugging why v2 vault not found
      console.log(`V2 vault not found in GraphQL response for ${cfg.address}:`, {
        queryAddress: cfg.address,
        chainId: cfg.chainId,
        hasVaultV2ByAddress: !!data.vaultV2ByAddress,
        responseKeys: Object.keys(data),
      });
    }
    if (!vaultData) {
      if (isV2) {
        // For v2 vaults that aren't indexed, return minimal data structure
        // The frontend will handle null values appropriately
        const responseHeaders = new Headers(rateLimitResult.headers);
        responseHeaders.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        
        return NextResponse.json({
          ...cfg,
          tvl: null,
          apy: null,
          depositors: 0,
          revenueAllTime: null,
          feesAllTime: null,
          lastHarvest: null,
          apyBreakdown: null,
          rewards: [],
          allocation: [],
          queues: { supplyQueueIndex: null, withdrawQueueIndex: null },
          warnings: [],
          metadata: {},
          historicalData: { apy: [], netApy: [], totalAssets: [], totalAssetsUsd: [] },
          roles: { owner: null, curator: null, guardian: null, timelock: null },
          transactions: [],
          parameters: {
            performanceFeeBps: null,
            performanceFeePercent: null,
            maxDeposit: null,
            maxWithdrawal: null,
            strategyNotes: '',
          },
        }, { headers: responseHeaders });
      } else {
        // For v1 vaults, return 404 if not found
        throw new AppError('Vault not found in Morpho API', 404, 'VAULT_NOT_FOUND');
      }
    }

    // Type assertion for vault data - structure matches our query
    // V2 vaults have fields directly on the vault, V1 vaults have them in a state object
    const mv = vaultData as {
      address?: string;
      name?: string | null;
      symbol?: string | null;
      whitelisted?: boolean | null;
      metadata?: {
        description?: string | null;
        forumLink?: string | null;
        image?: string | null;
        curators?: Array<{ image?: string | null; name?: string | null; url?: string | null }>;
      } | null;
      allocators?: Array<{ address: string }>;
      asset?: {
        address?: string;
        symbol?: string;
        decimals?: number;
        yield?: { apr?: number | null } | null;
      } | null;
      // V2 vault fields (direct on vault)
      totalAssetsUsd?: number | null;
      performanceFee?: number | null;
      managementFee?: number | null;
      maxApy?: number | null;
      avgApy?: number | null;
      avgNetApy?: number | null;
      curator?: { address?: string | null } | null;
      owner?: { address?: string | null } | null;
      positions?: {
        items?: Array<{ user?: { address?: string | null } | null } | null> | null;
      } | null;
      // V2 vault rewards (direct on vault, not in state)
      rewards?: Array<{
        asset?: { address?: string; chain?: { id?: number } | null } | null;
        supplyApr?: number | null;
        yearlySupplyTokens?: number | null;
      }>;
      // V1 vault fields (in state object)
      state?: {
        owner?: string | null;
        curator?: string | null;
        guardian?: string | null;
        timelock?: string | null;
        totalAssets?: string | null;
        totalAssetsUsd?: number | null;
        totalSupply?: string | null;
        totalSupplyShares?: string | null;
        supplyQueue?: number[];
        withdrawQueue?: number[];
        lastUpdate?: number | null;
        apy?: number | null;
        netApy?: number | null;
        netApyWithoutRewards?: number | null;
        avgApy?: number | null;
        avgNetApy?: number | null;
        dailyApy?: number | null;
        dailyNetApy?: number | null;
        weeklyApy?: number | null;
        weeklyNetApy?: number | null;
        monthlyApy?: number | null;
        monthlyNetApy?: number | null;
        fee?: number | null;
        warnings?: Array<{ type?: string; level?: string }>;
        rewards?: Array<{
          asset?: { address?: string; chain?: { id?: number } | null } | null;
          supplyApr?: number | null;
          yearlySupplyTokens?: number | null;
        }>;
        allocation?: Array<{
          supplyAssets?: string | null;
          supplyAssetsUsd?: number | null;
          supplyCap?: string | null;
          market?: {
            uniqueKey?: string;
            loanAsset?: { name?: string | null } | null;
            collateralAsset?: { name?: string | null } | null;
            oracleAddress?: string | null;
            irmAddress?: string | null;
            lltv?: string | null;
            state?: {
              rewards?: Array<{
                asset?: { address?: string; chain?: { id?: number } | null } | null;
                supplyApr?: number | null;
                borrowApr?: number | null;
              }>;
            } | null;
          } | null;
        }>;
        lastTotalAssets?: string | null;
        allocationQueues?: {
          supplyQueueIndex?: number | null;
          withdrawQueueIndex?: number | null;
          market?: { uniqueKey?: string } | null;
        } | null;
      } | null;
      historicalState?: {
        apy?: Array<{ x?: number; y?: number }>;
        netApy?: Array<{ x?: number; y?: number }>;
        totalAssets?: Array<{ x?: number; y?: number }>;
        totalAssetsUsd?: Array<{ x?: number; y?: number }>;
      } | null;
    } | null;
    // Handle positions - v2 has positions on vault, v1 has them in separate query
    const v2Positions = mv?.positions?.items || [];
    const v1Positions = (data.positions?.items || []);
    const allPositions = isV2 ? v2Positions : v1Positions;
    
    // Handle transactions - both v1 and v2 use the same transactions query
    const txs = (data.txs?.items || []).filter(
      (t): t is {
        blockNumber: number;
        hash: string;
        type: string;
        user?: { address?: string | null } | null;
      } => t !== null
    );
    
    const positions = allPositions.filter(
      (p): p is { user: { address: string } } => p !== null && p?.user !== null && p?.user !== undefined && p.user.address !== undefined
    );
    
    const depositors = new Set(
      positions
        .map((p) => p.user.address.toLowerCase())
        .filter((addr): addr is string => addr !== undefined && addr !== null)
    ).size;

    // V2 vaults have fields directly, V1 vaults have them in state object
    const tvlUsd = isV2 
      ? (mv?.totalAssetsUsd ?? 0)
      : (mv?.state?.totalAssetsUsd ?? 0);
    
    const apyPct = isV2
      ? ((mv?.avgNetApy ?? mv?.avgApy ?? mv?.maxApy ?? 0) * 100)
      : ((mv?.state?.netApy ?? mv?.state?.avgNetApy ?? mv?.state?.apy ?? 0) * 100);
    
    const apyBasePct = isV2
      ? ((mv?.avgApy ?? mv?.maxApy ?? 0) * 100)
      : ((mv?.state?.apy ?? 0) * 100);
    
    const apyBoostedPct = isV2
      ? ((mv?.avgNetApy ?? 0) * 100)
      : ((mv?.state?.netApy ?? 0) * 100);
    
    // V2 caps structure is different, skip utilization for now
    // V1 uses allocation
    const utilization = isV2
      ? 0 // V2 caps structure needs to be investigated separately
      : (mv?.state?.allocation?.reduce((sum, a) => {
          const cap = a.supplyCap ? (typeof a.supplyCap === 'bigint' ? Number(a.supplyCap) : Number(a.supplyCap)) : 0;
          const assets = a.supplyAssets ? (typeof a.supplyAssets === 'bigint' ? Number(a.supplyAssets) : Number(a.supplyAssets)) : 0;
          return cap > 0 ? sum + (assets / cap) : sum;
        }, 0) ?? 0);
    
    // Get performance fee from Morpho API (decimal like 0.05 = 5%)
    const performanceFeeBps = isV2
      ? (mv?.performanceFee ? Math.round(mv.performanceFee * 10000) : null)
      : (mv?.state?.fee ? Math.round(mv.state.fee * 10000) : null);

    const result = {
      ...cfg,
      address: address, // Ensure address is explicitly set
      name: mv?.name || 'Unknown Vault',
      symbol: mv?.symbol || mv?.asset?.symbol || 'UNKNOWN',
      asset: mv?.asset?.symbol || 'UNKNOWN',
      tvl: tvlUsd,
      apy: apyPct,
      apyBase: apyBasePct,
      apyBoosted: apyBoostedPct,
      feesYtd: null,
      utilization: utilization,
      depositors,
      revenueAllTime: null,
      feesAllTime: null,
      lastHarvest: null,
      apyBreakdown: isV2 ? {
        apy: (mv?.avgApy ?? mv?.maxApy ?? 0) * 100,
        netApy: (mv?.avgNetApy ?? 0) * 100,
        netApyWithoutRewards: (mv?.avgNetApy ?? 0) * 100,
        avgApy: (mv?.avgApy ?? 0) * 100,
        avgNetApy: (mv?.avgNetApy ?? 0) * 100,
        dailyApy: null,
        dailyNetApy: null,
        weeklyApy: null,
        weeklyNetApy: null,
        monthlyApy: null,
        monthlyNetApy: null,
        underlyingYieldApr: null,
      } : {
        apy: (mv?.state?.apy ?? 0) * 100,
        netApy: (mv?.state?.netApy ?? 0) * 100,
        netApyWithoutRewards: (mv?.state?.netApyWithoutRewards ?? 0) * 100,
        avgApy: (mv?.state?.avgApy ?? 0) * 100,
        avgNetApy: (mv?.state?.avgNetApy ?? 0) * 100,
        dailyApy: (mv?.state?.dailyApy ?? 0) * 100,
        dailyNetApy: (mv?.state?.dailyNetApy ?? 0) * 100,
        weeklyApy: (mv?.state?.weeklyApy ?? 0) * 100,
        weeklyNetApy: (mv?.state?.weeklyNetApy ?? 0) * 100,
        monthlyApy: (mv?.state?.monthlyApy ?? 0) * 100,
        monthlyNetApy: (mv?.state?.monthlyNetApy ?? 0) * 100,
        underlyingYieldApr: (mv?.asset?.yield?.apr ?? 0) * 100,
      },
      rewards: isV2
        ? (mv?.rewards || []).map((r: { asset?: { address?: string; chain?: { id?: number } | null } | null; supplyApr?: number | null; yearlySupplyTokens?: number | null }) => ({
            assetAddress: r.asset?.address ?? '',
            chainId: r.asset?.chain?.id ?? null,
            supplyApr: (r.supplyApr ?? 0) * 100,
            yearlySupplyTokens: r.yearlySupplyTokens ? (typeof r.yearlySupplyTokens === 'bigint' ? Number(r.yearlySupplyTokens) : r.yearlySupplyTokens) : 0,
          }))
        : (mv?.state?.rewards || []).map((r) => ({
            assetAddress: r.asset?.address ?? '',
            chainId: r.asset?.chain?.id ?? null,
            supplyApr: (r.supplyApr ?? 0) * 100,
            yearlySupplyTokens: r.yearlySupplyTokens ? (typeof r.yearlySupplyTokens === 'bigint' ? Number(r.yearlySupplyTokens) : r.yearlySupplyTokens) : 0,
          })),
      allocation: [],
      queues: {
        supplyQueueIndex: isV2 ? null : (mv?.state?.allocationQueues?.supplyQueueIndex ?? null),
        withdrawQueueIndex: isV2 ? null : (mv?.state?.allocationQueues?.withdrawQueueIndex ?? null),
      },
      warnings: [],
      metadata: mv?.metadata || {},
      historicalData: {
        apy: mv?.historicalState?.apy || [],
        netApy: mv?.historicalState?.netApy || [],
        totalAssets: mv?.historicalState?.totalAssets || [],
        totalAssetsUsd: mv?.historicalState?.totalAssetsUsd || [],
      },
      roles: {
        owner: null,
        curator: null,
        guardian: null,
        timelock: null,
      },
      transactions: txs.map((t) => ({
        blockNumber: t.blockNumber,
        hash: t.hash,
        type: t.type,
        userAddress: t.user?.address ?? null,
      })),
      parameters: {
        performanceFeeBps: performanceFeeBps,
        performanceFeePercent: performanceFeeBps ? performanceFeeBps / 100 : null,
        maxDeposit: null,
        maxWithdrawal: null,
        strategyNotes: '',
      },
    };

    const responseHeaders = new Headers(rateLimitResult.headers);
    responseHeaders.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    return NextResponse.json(result, { headers: responseHeaders });
  } catch (err) {
    const { error, statusCode } = handleApiError(err, 'Failed to fetch vault details');
    return NextResponse.json(error, { status: statusCode });
  }
}


