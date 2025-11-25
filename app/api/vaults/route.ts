import { NextResponse } from 'next/server';
import { vaults as configuredVaults } from '@/lib/config/vaults';
import { MORPHO_GRAPHQL_ENDPOINT, BASE_CHAIN_ID, GRAPHQL_FIRST_LIMIT } from '@/lib/constants';
import { fetchExternalApi } from '@/lib/utils/fetch-with-timeout';
import { handleApiError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';

type MorphoVaultItem = {
  address: string;
  asset: {
    decimals: number | null;
  } | null;
  state: {
    totalAssets: string | null;
    totalAssetsUsd: number | null;
    weeklyNetApy: number | null;
    monthlyNetApy: number | null;
  };
};

type MorphoPositionItem = {
  vault: { address: string };
  user: { address: string };
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
    // Limit to known vault addresses in config; this keeps metadata (name, symbol, etc.)
    const addresses = configuredVaults.map(v => v.address.toLowerCase());

    // Build a single GraphQL query to fetch vaults and positions
    const query = `
      query FetchVaultsAndPositions($addresses: [String!]) {
        vaults(
          first: ${GRAPHQL_FIRST_LIMIT}
          where: { address_in: $addresses, chainId_in: [${BASE_CHAIN_ID}] }
        ) {
          items {
            address
            asset {
              decimals
            }
            state {
              totalAssets
              totalAssetsUsd
              weeklyNetApy
              monthlyNetApy
            }
          }
        }

        vaultPositions(
          first: ${GRAPHQL_FIRST_LIMIT}
          where: { vaultAddress_in: $addresses }
        ) {
          items {
            vault { address }
            user { address }
          }
        }
      }
    `;

    const response = await fetchExternalApi(MORPHO_GRAPHQL_ENDPOINT, {
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
      const totalAssetsRaw = m?.state?.totalAssets ? BigInt(m.state.totalAssets) : null;
      const assetDecimals = m?.asset?.decimals ?? 18; // Default to 18 if not found
      const weeklyNetApy = m?.state?.weeklyNetApy ?? 0; // decimal e.g. 0.05
      const monthlyNetApy = m?.state?.monthlyNetApy ?? 0; // decimal e.g. 0.07
      const depositors = depositorsByVault[v.address.toLowerCase()] ?? 0;

      return {
        ...v,
        tvl,
        tokenAmount: totalAssetsRaw?.toString() ?? null,
        assetDecimals,
        apy7d: weeklyNetApy * 100,
        apy30d: monthlyNetApy * 100,
        depositors,
        // Leave utilization and lastHarvest undefined here; UI handles gracefully
        utilization: 0,
        lastHarvest: null,
      };
    });

    const responseHeaders = new Headers(rateLimitResult.headers);
    responseHeaders.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    return NextResponse.json(merged, { headers: responseHeaders });
  } catch (err) {
    const { error, statusCode } = handleApiError(err, 'Failed to fetch vaults');
    return NextResponse.json(error, { status: statusCode });
  }
}


