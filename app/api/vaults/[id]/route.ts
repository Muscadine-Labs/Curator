import { NextRequest, NextResponse } from 'next/server';
import { getVaultByAddress, getVaultById } from '@/lib/config/vaults';
import { MORPHO_GRAPHQL_ENDPOINT, GRAPHQL_FIRST_LIMIT, GRAPHQL_TRANSACTIONS_LIMIT, getDaysAgoTimestamp } from '@/lib/constants';
import { fetchExternalApi } from '@/lib/utils/fetch-with-timeout';
import { handleApiError, AppError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';

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

    const query = `
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

    const resp = await fetchExternalApi(MORPHO_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `Morpho API error: ${text}` }, { status: 502 });
    }
    const json = await resp.json();
    if (json.errors) {
      return NextResponse.json({ error: json.errors }, { status: 502 });
    }

    const mv = json?.data?.vault;
    const positions = (json?.data?.positions?.items || []) as Array<{ user: { address: string } }>;
    const txs = (json?.data?.txs?.items || []) as Array<{ blockNumber: number; hash: string; type: string; user?: { address?: string } }>;
    const depositors = new Set(positions.map((p) => p.user.address.toLowerCase())).size;

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
      rewards: (mv?.state?.rewards || []).map((r: { asset?: { address?: string; chain?: { id?: number } | null } | null; supplyApr?: number | null; yearlySupplyTokens?: number | null }) => ({
        assetAddress: r?.asset?.address ?? '',
        chainId: r?.asset?.chain?.id ?? null,
        supplyApr: ((r?.supplyApr ?? 0) as number) * 100,
        yearlySupplyTokens: (r?.yearlySupplyTokens ?? 0) as number,
      })),
      allocation: (mv?.state?.allocation || []).map((a: {
        market?: {
          uniqueKey?: string;
          loanAsset?: { name?: string | null } | null;
          collateralAsset?: { name?: string | null } | null;
          oracleAddress?: string | null;
          irmAddress?: string | null;
          lltv?: number | null;
          state?: { rewards?: Array<{ asset?: { address?: string; chain?: { id?: number } | null } | null; supplyApr?: number | null; borrowApr?: number | null }> } | null;
        } | null;
        supplyCap?: number | null;
        supplyAssets?: number | null;
        supplyAssetsUsd?: number | null;
      }) => ({
        marketKey: a.market?.uniqueKey,
        loanAssetName: a.market?.loanAsset?.name ?? null,
        collateralAssetName: a.market?.collateralAsset?.name ?? null,
        oracleAddress: a.market?.oracleAddress ?? null,
        irmAddress: a.market?.irmAddress ?? null,
        lltv: a.market?.lltv ?? null,
        supplyCap: a.supplyCap ?? null,
        supplyAssets: a.supplyAssets ?? null,
        supplyAssetsUsd: a.supplyAssetsUsd ?? null,
        marketRewards: (a.market?.state?.rewards || []).map((mr: { asset?: { address?: string; chain?: { id?: number } | null } | null; supplyApr?: number | null; borrowApr?: number | null }) => ({
          assetAddress: mr?.asset?.address ?? '',
          chainId: mr?.asset?.chain?.id ?? null,
          supplyApr: ((mr?.supplyApr ?? 0) as number) * 100,
          borrowApr: mr?.borrowApr != null ? ((mr.borrowApr as number) * 100) : null,
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
      transactions: txs.map(t => ({
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


