import { NextRequest, NextResponse } from 'next/server';
import { getVaultByAddress, getVaultById } from '@/lib/config/vaults';
import { GRAPHQL_FIRST_LIMIT, GRAPHQL_TRANSACTIONS_LIMIT, getDaysAgoTimestamp } from '@/lib/constants';
import { handleApiError, AppError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { gql } from 'graphql-request';
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
    const cfg = getVaultById(id) ?? getVaultByAddress(id);
    if (!cfg) {
      throw new AppError('Vault not found', 404, 'VAULT_NOT_FOUND');
    }

    const variables = {
      address: cfg.address,
      chainId: cfg.chainId,
      options: {
        startTimestamp: getDaysAgoTimestamp(30),
        endTimestamp: Math.floor(Date.now() / 1000),
        interval: 'DAY'
      }
    };

    // Response type - complex nested structure from GraphQL
    // Using unknown for vault since it has deeply nested structure that matches our query
    type VaultDetailQueryResponse = {
      vault: unknown;
      positions: {
        items: Array<{ user: { address: string } } | null> | null;
      } | null;
      txs: {
        items: Array<{
          blockNumber: number;
          hash: string;
          type: string;
          user?: { address?: string | null } | null;
        } | null> | null;
      } | null;
    };

    const query = gql`
      query VaultDetail($address: String!, $chainId: Int!, $options: TimeseriesOptions) {
        vault: vaultByAddress(address: $address, chainId: $chainId) {
          address
          name
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
            totalSupplyShares
            supplyQueue
            withdrawQueue
            lastUpdate
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
            warnings { type level }
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

    const data = await morphoGraphQLClient.request<VaultDetailQueryResponse>(
      query,
      variables
    );

    // Type assertion for vault data - structure matches our query
    const mv = data.vault as {
      address?: string;
      name?: string | null;
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
        decimals?: number;
        yield?: { apr?: number | null } | null;
      } | null;
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
    const positions = (data.positions?.items || []).filter(
      (p): p is { user: { address: string } } => p !== null && p.user !== null && p.user.address !== undefined
    );
    const txs = (data.txs?.items || []).filter(
      (t): t is {
        blockNumber: number;
        hash: string;
        type: string;
        user?: { address?: string | null } | null;
      } => t !== null
    );
    
    const depositors = new Set(
      positions
        .map((p) => p.user.address.toLowerCase())
        .filter((addr): addr is string => addr !== undefined && addr !== null)
    ).size;

    const tvlUsd = mv?.state?.totalAssetsUsd ?? 0;
    const apyBasePct = (mv?.state?.avgApy ?? 0) * 100;
    const apyNetPct = (mv?.state?.avgNetApy ?? 0) * 100;

    const result = {
      ...cfg,
      tvl: tvlUsd,
      apyBase: apyBasePct,
      apyBoosted: apyNetPct,
      depositors,
      feesYtd: 0,
      utilization: 0,
      lastHarvest: null,
      apyBreakdown: {
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
      rewards: (mv?.state?.rewards || []).map((r) => ({
        assetAddress: r.asset?.address ?? '',
        chainId: r.asset?.chain?.id ?? null,
        supplyApr: (r.supplyApr ?? 0) * 100,
        yearlySupplyTokens: r.yearlySupplyTokens ? (typeof r.yearlySupplyTokens === 'bigint' ? Number(r.yearlySupplyTokens) : r.yearlySupplyTokens) : 0,
      })),
      allocation: (mv?.state?.allocation || []).map((a) => ({
        marketKey: a.market?.uniqueKey ?? null,
        loanAssetName: a.market?.loanAsset?.name ?? null,
        collateralAssetName: a.market?.collateralAsset?.name ?? null,
        oracleAddress: a.market?.oracleAddress ?? null,
        irmAddress: a.market?.irmAddress ?? null,
        lltv: a.market?.lltv ? (typeof a.market.lltv === 'bigint' ? Number(a.market.lltv) / 1e18 : typeof a.market.lltv === 'string' ? Number(a.market.lltv) / 1e18 : a.market.lltv / 1e18) : null,
        supplyCap: a.supplyCap ? (typeof a.supplyCap === 'bigint' ? Number(a.supplyCap) : typeof a.supplyCap === 'string' ? Number(a.supplyCap) : a.supplyCap) : null,
        supplyAssets: a.supplyAssets ? (typeof a.supplyAssets === 'bigint' ? Number(a.supplyAssets) : typeof a.supplyAssets === 'string' ? Number(a.supplyAssets) : a.supplyAssets) : null,
        supplyAssetsUsd: a.supplyAssetsUsd ?? null,
        marketRewards: (a.market?.state?.rewards || []).map((mr) => ({
          assetAddress: mr.asset?.address ?? '',
          chainId: mr.asset?.chain?.id ?? null,
          supplyApr: (mr.supplyApr ?? 0) * 100,
          borrowApr: mr.borrowApr != null ? (mr.borrowApr * 100) : null,
        })),
      })),
      queues: {
        supplyQueueIndex: mv?.state?.allocationQueues?.supplyQueueIndex ?? null,
        withdrawQueueIndex: mv?.state?.allocationQueues?.withdrawQueueIndex ?? null,
        supplyQueue: mv?.state?.supplyQueue || [],
        withdrawQueue: mv?.state?.withdrawQueue || [],
      },
      warnings: mv?.state?.warnings || [],
      metadata: mv?.metadata || {},
      historicalData: {
        apy: mv?.historicalState?.apy || [],
        netApy: mv?.historicalState?.netApy || [],
        totalAssets: mv?.historicalState?.totalAssets || [],
        totalAssetsUsd: mv?.historicalState?.totalAssetsUsd || [],
      },
      roles: {
        owner: mv?.state?.owner ?? null,
        curator: mv?.state?.curator ?? null,
        guardian: mv?.state?.guardian ?? null,
        timelock: mv?.state?.timelock ?? null,
      },
      transactions: txs.map((t) => ({
        blockNumber: t.blockNumber,
        hash: t.hash,
        type: t.type,
        userAddress: t.user?.address ?? null,
      })),
      parameters: {
        performanceFeeBps: cfg.performanceFeeBps,
        maxDeposit: null,
        maxWithdrawal: null,
        strategyNotes: cfg.description || '',
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


