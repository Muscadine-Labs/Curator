import { NextRequest, NextResponse } from 'next/server';
import { vaults as configuredVaults } from '@/lib/config/vaults';

const MORPHO_GRAPHQL_ENDPOINT = 'https://api.morpho.org/graphql';

type MorphoVaultItem = {
  address: string;
  state: {
    totalAssetsUsd: number | null;
    weeklyNetApy: number | null;
    monthlyNetApy: number | null;
  };
};

type MorphoPositionItem = {
  vault: { address: string };
  user: { address: string };
};

export async function GET(request: NextRequest) {
  try {
    // Limit to known vault addresses in config; this keeps metadata (name, symbol, etc.)
    const addresses = configuredVaults.map(v => v.address.toLowerCase());

    // Build a single GraphQL query to fetch vaults and positions
    const query = `
      query FetchVaultsAndPositions($addresses: [String!]) {
        vaults(
          first: 1000
          where: { address_in: $addresses, chainId_in: [1, 8453] }
        ) {
          items {
            address
            state {
              totalAssetsUsd
              weeklyNetApy
              monthlyNetApy
            }
          }
        }

        vaultPositions(
          first: 1000
          where: { vaultAddress_in: $addresses }
        ) {
          items {
            vault { address }
            user { address }
          }
        }
      }
    `;

    const response = await fetch(MORPHO_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { addresses },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `Morpho API error: ${text}` }, { status: 502 });
    }

    const json = await response.json();
    if (json.errors) {
      return NextResponse.json({ error: json.errors }, { status: 502 });
    }

    const morphoVaults: MorphoVaultItem[] = json?.data?.vaults?.items ?? [];
    const positions: MorphoPositionItem[] = json?.data?.vaultPositions?.items ?? [];

    // Compute depositors per vault by counting unique users per vault address
    const depositorsByVault: Record<string, number> = {};
    for (const pos of positions) {
      const addr = pos.vault.address.toLowerCase();
      depositorsByVault[addr] = (depositorsByVault[addr] || 0) + 1;
    }

    // Map Morpho data by address for quick lookups
    const morphoByAddress: Record<string, MorphoVaultItem> = {};
    for (const v of morphoVaults) {
      morphoByAddress[v.address.toLowerCase()] = v;
    }

    // Merge configured vault metadata with Morpho stats
    const merged = configuredVaults.map(v => {
      const m = morphoByAddress[v.address.toLowerCase()];
      const tvl = m?.state?.totalAssetsUsd ?? 0;
      const weeklyNetApy = m?.state?.weeklyNetApy ?? 0; // decimal e.g. 0.05
      const monthlyNetApy = m?.state?.monthlyNetApy ?? 0; // decimal e.g. 0.07
      const depositors = depositorsByVault[v.address.toLowerCase()] ?? 0;

      return {
        ...v,
        tvl,
        apy7d: weeklyNetApy * 100,
        apy30d: monthlyNetApy * 100,
        depositors,
        // Leave utilization and lastHarvest undefined here; UI handles gracefully
        utilization: 0,
        lastHarvest: null,
      };
    });

    return NextResponse.json(merged);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}


