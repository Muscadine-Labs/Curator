import { NextResponse } from 'next/server';
import { vaults as configuredVaults } from '@/lib/config/vaults';
import { MORPHO_GRAPHQL_ENDPOINT, BASE_CHAIN_ID, GRAPHQL_FIRST_LIMIT } from '@/lib/constants';
import { fetchExternalApi } from '@/lib/utils/fetch-with-timeout';
import { handleApiError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';

type VaultAlloc = {
  address: string;
  state: {
    allocation: Array<{
      supplyAssetsUsd: number | null;
      market: { uniqueKey: string };
    }>;
  };
};

type MarketItem = {
  uniqueKey: string;
  lltv: number | null;
  oracleAddress: string | null;
  irmAddress: string | null;
  loanAsset: { address: string; symbol: string; decimals: number };
  collateralAsset: { address: string; symbol: string; decimals: number };
  state: {
    borrowAssetsUsd: number | null;
    supplyAssetsUsd: number | null;
    liquidityAssetsUsd: number | null;
    utilization: number | null;
    supplyApy: number | null;
    rewards: Array<{
      asset: { address: string; chain?: { id?: number } | null };
      supplyApr: number | null;
      borrowApr: number | null;
    }>;
  };
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
    const vaultAddresses = configuredVaults.map(v => v.address.toLowerCase());
    const configByAddress = new Map(
      configuredVaults.map((v) => [v.address.toLowerCase(), v])
    );

    // 1) Fetch vault allocations to discover markets we supply to
    const vaultsQuery = `
      query VaultAllocations($addresses: [String!]) {
        vaults(first: ${GRAPHQL_FIRST_LIMIT}, where: { address_in: $addresses, chainId_in: [${BASE_CHAIN_ID}] }) {
          items {
            address
            state {
              allocation {
                supplyAssetsUsd
                market { uniqueKey }
              }
            }
          }
        }
      }
    `;

    const vResp = await fetchExternalApi(MORPHO_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: vaultsQuery, variables: { addresses: vaultAddresses } }),
    });
    if (!vResp.ok) {
      const text = await vResp.text();
      throw new Error(`Morpho API error: ${text}`);
    }
    const vJson = await vResp.json();
    if (vJson.errors) throw new Error(JSON.stringify(vJson.errors));

    const vaultItems: VaultAlloc[] = vJson?.data?.vaults?.items ?? [];
    const vaultAllocations = vaultItems.map((v) => {
      const allocations = (v.state?.allocation || []).map((a) => ({
        marketKey: a.market.uniqueKey,
        supplyAssetsUsd: a.supplyAssetsUsd ?? 0,
      }));
      const totalSupplyUsd = allocations.reduce((sum, a) => sum + (a.supplyAssetsUsd ?? 0), 0);
      const config = configByAddress.get(v.address.toLowerCase());

      return {
        address: v.address,
        version: config?.version ?? 'v1',
        name: config?.name ?? v.address,
        symbol: config?.symbol ?? '',
        totalSupplyUsd,
        allocations: allocations.map((a) => ({
          ...a,
          sharePct: totalSupplyUsd > 0 ? (a.supplyAssetsUsd ?? 0) / totalSupplyUsd : 0,
        })),
      };
    });

    const uniqueMarketKeys = Array.from(new Set(
      vaultAllocations.flatMap(v => v.allocations.map(a => a.marketKey))
    ));

    if (uniqueMarketKeys.length === 0) {
      return NextResponse.json({ markets: [], vaultAllocations });
    }

    // 2) Fetch market details for these markets
    const marketsQuery = `
      query Markets($chainIds: [Int!]) {
        markets(first: ${GRAPHQL_FIRST_LIMIT}, where: { chainId_in: $chainIds }) {
          items {
            uniqueKey
            lltv
            oracleAddress
            irmAddress
            loanAsset { address symbol decimals }
            collateralAsset { address symbol decimals }
            state {
              borrowAssetsUsd
              supplyAssetsUsd
              liquidityAssetsUsd
              utilization
              supplyApy
              rewards {
                asset { address chain { id } }
                supplyApr
                borrowApr
              }
            }
          }
        }
      }
    `;

    const mResp = await fetchExternalApi(MORPHO_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: marketsQuery, variables: { chainIds: [BASE_CHAIN_ID] } }),
    });
    if (!mResp.ok) {
      const text = await mResp.text();
      throw new Error(`Morpho API error: ${text}`);
    }
    const mJson = await mResp.json();
    if (mJson.errors) throw new Error(JSON.stringify(mJson.errors));

    const allMarkets: MarketItem[] = mJson?.data?.markets?.items ?? [];
    const marketsByKey: Record<string, MarketItem> = {};
    for (const m of allMarkets) marketsByKey[m.uniqueKey] = m;

    const filteredMarkets = uniqueMarketKeys
      .map(k => marketsByKey[k])
      .filter(Boolean);

    // 3) Shape response
    const markets = filteredMarkets.map((m) => ({
      uniqueKey: m.uniqueKey,
      lltv: m.lltv ? m.lltv / 1e18 : null, // Convert from wei to decimal (0.86 = 86%)
      oracleAddress: m.oracleAddress,
      irmAddress: m.irmAddress,
      loanAsset: m.loanAsset || null,
      collateralAsset: m.collateralAsset || null,
      state: {
        supplyAssetsUsd: m.state?.supplyAssetsUsd ?? 0,
        borrowAssetsUsd: m.state?.borrowAssetsUsd ?? 0,
        liquidityAssetsUsd: m.state?.liquidityAssetsUsd ?? 0,
        utilization: m.state?.utilization ?? 0,
        supplyApy: m.state?.supplyApy ?? 0,
        rewards: (m.state?.rewards || []).map(r => ({
          assetAddress: r.asset?.address,
          chainId: r.asset?.chain?.id ?? null,
          supplyApr: (r.supplyApr ?? 0) * 100,
          borrowApr: (r.borrowApr ?? 0) * 100,
        })),
      },
    }));

    return NextResponse.json({
      markets,
      vaultAllocations,
      availableMarkets: allMarkets.map((m) => ({
        uniqueKey: m.uniqueKey,
        lltv: m.lltv ? m.lltv / 1e18 : null,
        oracleAddress: m.oracleAddress,
        irmAddress: m.irmAddress,
        loanAsset: m.loanAsset || null,
        collateralAsset: m.collateralAsset || null,
        state: {
          supplyAssetsUsd: m.state?.supplyAssetsUsd ?? 0,
          borrowAssetsUsd: m.state?.borrowAssetsUsd ?? 0,
          liquidityAssetsUsd: m.state?.liquidityAssetsUsd ?? 0,
          utilization: m.state?.utilization ?? 0,
          supplyApy: m.state?.supplyApy ?? 0,
          rewards: (m.state?.rewards || []).map((r) => ({
            assetAddress: r.asset?.address,
            chainId: r.asset?.chain?.id ?? null,
            supplyApr: (r.supplyApr ?? 0) * 100,
            borrowApr: (r.borrowApr ?? 0) * 100,
          })),
        },
      })),
    });
  } catch (err) {
    const { error, statusCode } = handleApiError(err, 'Failed to fetch markets data');
    return NextResponse.json(error, { status: statusCode });
  }
}

