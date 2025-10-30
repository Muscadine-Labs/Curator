import { NextResponse } from 'next/server';
import { vaults as configuredVaults } from '@/lib/config/vaults';

const MORPHO_GRAPHQL_ENDPOINT = 'https://api.morpho.org/graphql';

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
    rewards: Array<{
      asset: { address: string; chain?: { id?: number } | null };
      supplyApr: number | null;
      borrowApr: number | null;
    }>;
  };
};

export async function GET() {
  try {
    const vaultAddresses = configuredVaults.map(v => v.address.toLowerCase());

    // 1) Fetch vault allocations to discover markets we supply to
    const vaultsQuery = `
      query VaultAllocations($addresses: [String!]) {
        vaults(first: 1000, where: { address_in: $addresses, chainId_in: [1, 8453] }) {
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

    const vResp = await fetch(MORPHO_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: vaultsQuery, variables: { addresses: vaultAddresses } }),
    });
    if (!vResp.ok) {
      const text = await vResp.text();
      return NextResponse.json({ error: `Morpho API error: ${text}` }, { status: 502 });
    }
    const vJson = await vResp.json();
    if (vJson.errors) return NextResponse.json({ error: vJson.errors }, { status: 502 });

    const vaultItems: VaultAlloc[] = vJson?.data?.vaults?.items ?? [];
    const vaultAllocations = vaultItems.map(v => ({
      address: v.address,
      allocations: (v.state?.allocation || []).map(a => ({
        marketKey: a.market.uniqueKey,
        supplyAssetsUsd: a.supplyAssetsUsd ?? 0,
      })),
    }));

    const uniqueMarketKeys = Array.from(new Set(
      vaultAllocations.flatMap(v => v.allocations.map(a => a.marketKey))
    ));

    if (uniqueMarketKeys.length === 0) {
      return NextResponse.json({ markets: [], vaultAllocations });
    }

    // 2) Fetch market details for these markets
    const marketsQuery = `
      query Markets($chainIds: [Int!]) {
        markets(first: 1000, where: { chainId_in: $chainIds }) {
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

    const mResp = await fetch(MORPHO_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: marketsQuery, variables: { chainIds: [1, 8453] } }),
    });
    if (!mResp.ok) {
      const text = await mResp.text();
      return NextResponse.json({ error: `Morpho API error: ${text}` }, { status: 502 });
    }
    const mJson = await mResp.json();
    if (mJson.errors) return NextResponse.json({ error: mJson.errors }, { status: 502 });

    const allMarkets: MarketItem[] = mJson?.data?.markets?.items ?? [];
    const marketsByKey: Record<string, MarketItem> = {};
    for (const m of allMarkets) marketsByKey[m.uniqueKey] = m;

    const filteredMarkets = uniqueMarketKeys
      .map(k => marketsByKey[k])
      .filter(Boolean);

    // 3) Historical charts: supplyAssetsUsd and APYs (last 30 days, DAY)
    const nowSec = Math.floor(Date.now() / 1000);
    const thirtyDaysSec = nowSec - 30 * 24 * 60 * 60;
    const historyPromises = uniqueMarketKeys.map(async (uniqueKey) => {
      const histQuery = `
        query MarketHistory($uniqueKey: String!, $options: TimeseriesOptions) {
          marketByUniqueKey(uniqueKey: $uniqueKey) {
            uniqueKey
            historicalState {
              supplyAssetsUsd(options: $options) { x y }
              supplyApy(options: $options) { x y }
              borrowApy(options: $options) { x y }
            }
          }
        }
      `;
      const hResp = await fetch(MORPHO_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: histQuery,
          variables: {
            uniqueKey,
            options: { startTimestamp: thirtyDaysSec, endTimestamp: nowSec, interval: 'DAY' },
          },
        }),
      });
      if (!hResp.ok) return { uniqueKey, tvl: [], supplyApy: [], borrowApy: [] } as { uniqueKey: string; tvl: { date: string; value: number }[]; supplyApy: { date: string; value: number }[]; borrowApy: { date: string; value: number }[] };
      const hJson = await hResp.json();
      const hs = hJson?.data?.marketByUniqueKey?.historicalState;
      type TSPoint = { x: number; y: number | null };
      const mapPoint = (p: TSPoint) => ({ date: new Date(p.x * 1000).toISOString(), value: (p.y ?? 0) });
      const mapPct = (p: TSPoint) => ({ date: new Date(p.x * 1000).toISOString(), value: ((p.y ?? 0) * 100) });
      return {
        uniqueKey,
        tvl: (hs?.supplyAssetsUsd || []).map((p: TSPoint) => mapPoint(p)),
        supplyApy: (hs?.supplyApy || []).map((p: TSPoint) => mapPct(p)),
        borrowApy: (hs?.borrowApy || []).map((p: TSPoint) => mapPct(p)),
      } as { uniqueKey: string; tvl: { date: string; value: number }[]; supplyApy: { date: string; value: number }[]; borrowApy: { date: string; value: number }[] };
    });

    const histories = await Promise.all(historyPromises);
    type SeriesPoint = { date: string; value: number };
    const historyByKey: Record<string, { tvl: SeriesPoint[]; supplyApy: SeriesPoint[]; borrowApy: SeriesPoint[] }> = {};
    for (const h of histories) historyByKey[h.uniqueKey] = { tvl: h.tvl as SeriesPoint[], supplyApy: h.supplyApy as SeriesPoint[], borrowApy: h.borrowApy as SeriesPoint[] };

    // 4) Shape response
    const markets = filteredMarkets.map((m) => ({
      uniqueKey: m.uniqueKey,
      lltv: m.lltv,
      oracleAddress: m.oracleAddress,
      irmAddress: m.irmAddress,
      loanAsset: m.loanAsset,
      collateralAsset: m.collateralAsset,
      state: {
        supplyAssetsUsd: m.state?.supplyAssetsUsd ?? 0,
        borrowAssetsUsd: m.state?.borrowAssetsUsd ?? 0,
        liquidityAssetsUsd: m.state?.liquidityAssetsUsd ?? 0,
        utilization: m.state?.utilization ?? 0,
        rewards: (m.state?.rewards || []).map(r => ({
          assetAddress: r.asset?.address,
          chainId: r.asset?.chain?.id ?? null,
          supplyApr: (r.supplyApr ?? 0) * 100,
          borrowApr: (r.borrowApr ?? 0) * 100,
        })),
      },
      history: historyByKey[m.uniqueKey] || { tvl: [], supplyApy: [], borrowApy: [] },
    }));

    return NextResponse.json({ markets, vaultAllocations });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}


