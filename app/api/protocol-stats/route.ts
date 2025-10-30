import { NextResponse } from 'next/server';
import { vaults as configuredVaults } from '@/lib/config/vaults';

const MORPHO_GRAPHQL_ENDPOINT = 'https://api.morpho.org/graphql';

type MorphoVaultItem = {
  address: string;
  state: {
    totalAssetsUsd: number | null;
  };
};

type MorphoPositionItem = {
  vault: { address: string };
  user: { address: string };
};

export async function GET() {
  try {
    const addresses = configuredVaults.map(v => v.address.toLowerCase());

    const query = `
      query FetchProtocolStats($addresses: [String!]) {
        vaults(
          first: 1000
          where: { address_in: $addresses, chainId_in: [1, 8453] }
        ) {
          items {
            address
            state { totalAssetsUsd }
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { addresses } }),
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

    const totalDeposited = morphoVaults.reduce((sum, v) => sum + (v.state.totalAssetsUsd ?? 0), 0);
    const activeVaults = configuredVaults.length;

    // Unique depositors across our vaults
    const uniqueUsers = new Set<string>();
    for (const p of positions) uniqueUsers.add(p.user.address.toLowerCase());

    // Minimal placeholder trends (current TVL as a flat series) to avoid mocks
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const tvlTrend = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      return { date: date.toISOString(), value: totalDeposited };
    });

    const feesTrend: Array<{ date: string; value: number }> = [];

    const stats = {
      totalDeposited,
      totalFeesGenerated: 0,
      activeVaults,
      volume30d: 0,
      users: uniqueUsers.size,
      tvlTrend,
      feesTrend,
    };

    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}


