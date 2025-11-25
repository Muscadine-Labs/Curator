import { NextResponse } from 'next/server';
import { vaults as configuredVaults } from '@/lib/config/vaults';
import { BASE_CHAIN_ID, GRAPHQL_FIRST_LIMIT } from '@/lib/constants';
import { handleApiError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { gql } from 'graphql-request';
import type { Vault, Market, Maybe } from '@morpho-org/blue-api-sdk';

// Type-safe response types matching our queries
type VaultAllocationsQueryResponse = {
  vaults: {
    items: Maybe<Vault>[] | null;
  } | null;
};

type MarketsQueryResponse = {
  markets: {
    items: Maybe<Market>[] | null;
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
    const vaultAddresses = configuredVaults.map(v => v.address.toLowerCase());
    const configByAddress = new Map(
      configuredVaults.map((v) => [v.address.toLowerCase(), v])
    );

    // 1) Fetch vault allocations to discover markets we supply to
    const vaultsQuery = gql`
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

    const vaultData = await morphoGraphQLClient.request<VaultAllocationsQueryResponse>(
      vaultsQuery,
      { addresses: vaultAddresses }
    );

    const vaultItems = vaultData.vaults?.items?.filter((v): v is Vault => v !== null) ?? [];
    const vaultAllocations = vaultItems.map((v) => {
      const allocations = (v.state?.allocation || []).map((a) => ({
        marketKey: a.market?.uniqueKey ?? '',
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
    const marketsQuery = gql`
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

    const marketData = await morphoGraphQLClient.request<MarketsQueryResponse>(
      marketsQuery,
      { chainIds: [BASE_CHAIN_ID] }
    );

    const allMarkets = marketData.markets?.items?.filter((m): m is Market => m !== null) ?? [];
    const marketsByKey: Record<string, Market> = {};
    for (const m of allMarkets) {
      if (m.uniqueKey) {
        marketsByKey[m.uniqueKey] = m;
      }
    }

    const filteredMarkets = uniqueMarketKeys
      .map(k => marketsByKey[k])
      .filter(Boolean);

    // 3) Shape response
    const markets = filteredMarkets.map((m) => {
      const lltv = m.lltv ? (typeof m.lltv === 'bigint' ? Number(m.lltv) / 1e18 : m.lltv / 1e18) : null;
      return {
        uniqueKey: m.uniqueKey ?? '',
        lltv, // Convert from wei to decimal (0.86 = 86%)
        oracleAddress: m.oracleAddress ?? null,
        irmAddress: m.irmAddress ?? null,
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
      };
    });

    const mapMarket = (m: Market) => {
      const lltv = m.lltv ? (typeof m.lltv === 'bigint' ? Number(m.lltv) / 1e18 : m.lltv / 1e18) : null;
      return {
        uniqueKey: m.uniqueKey ?? '',
        lltv,
        oracleAddress: m.oracleAddress ?? null,
        irmAddress: m.irmAddress ?? null,
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
      };
    };

    return NextResponse.json({
      markets,
      vaultAllocations,
      availableMarkets: allMarkets.map(mapMarket),
    });
  } catch (err) {
    const { error, statusCode } = handleApiError(err, 'Failed to fetch markets data');
    return NextResponse.json(error, { status: statusCode });
  }
}

