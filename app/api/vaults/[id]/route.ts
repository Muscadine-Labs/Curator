import { NextRequest, NextResponse } from 'next/server';
import { getVaultById } from '@/lib/config/vaults';

const MORPHO_GRAPHQL_ENDPOINT = 'https://api.morpho.org/graphql';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cfg = getVaultById(id);
    if (!cfg) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    }

    const variables = {
      address: cfg.address,
      chainId: cfg.chainId,
    };

    const query = `
      query VaultDetail($address: String!, $chainId: Int!) {
        vault: vaultByAddress(address: $address, chainId: $chainId) {
          address
          asset { address decimals }
          state {
            totalAssets
            totalAssetsUsd
            totalSupply
            apy
            netApy
            avgApy
            avgNetApy
            dailyApy
            dailyNetApy
            weeklyApy
            weeklyNetApy
            monthlyApy
            monthlyNetApy
            rewards {
              asset { address }
              supplyApr
              yearlySupplyTokens
            }
            allocation {
              supplyAssets
              supplyAssetsUsd
              market { uniqueKey }
            }
          }
        }
        positions: vaultPositions(
          first: 1000,
          where: { vaultAddress_in: [$address] }
        ) {
          items { user { address } }
        }
      }
    `;

    const resp = await fetch(MORPHO_GRAPHQL_ENDPOINT, {
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
      charts: null,
      parameters: {
        performanceFeeBps: cfg.performanceFeeBps,
        maxDeposit: null,
        maxWithdrawal: null,
        strategyNotes: cfg.description || '',
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}


