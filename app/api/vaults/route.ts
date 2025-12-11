import { NextResponse } from 'next/server';
import { vaults as configuredVaults } from '@/lib/config/vaults';
import { BASE_CHAIN_ID, GRAPHQL_FIRST_LIMIT } from '@/lib/constants';
import { handleApiError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { gql } from 'graphql-request';
import type { Vault, VaultPosition, Maybe } from '@morpho-org/blue-api-sdk';

// Type-safe response matching our query structure
type VaultsQueryResponse = {
  vaults: {
    items: Maybe<Vault>[] | null;
  } | null;
  vaultPositions: {
    items: Maybe<VaultPosition>[] | null;
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
    // Limit to known vault addresses in config; this keeps metadata (name, symbol, etc.)
    const addresses = configuredVaults.map(v => v.address.toLowerCase());

    // Build a single GraphQL query to fetch vaults and positions
    const query = gql`
      query FetchVaultsAndPositions($addresses: [String!]) {
        vaults(
          first: ${GRAPHQL_FIRST_LIMIT}
          where: { address_in: $addresses, chainId_in: [${BASE_CHAIN_ID}] }
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

    const data = await morphoGraphQLClient.request<VaultsQueryResponse>(
      query,
      { addresses }
    );

    const morphoVaults = data.vaults?.items?.filter((v): v is Vault => v !== null) ?? [];
    const positions = data.vaultPositions?.items?.filter((p): p is VaultPosition => p !== null) ?? [];

    // Compute depositors per vault by counting unique users per vault address
    const depositorsByVault: Record<string, number> = {};
    for (const pos of positions) {
      const addr = pos.vault?.address?.toLowerCase();
      if (addr) {
        depositorsByVault[addr] = (depositorsByVault[addr] || 0) + 1;
      }
    }

    // Map Morpho data by address for quick lookups
    const morphoByAddress: Record<string, Vault> = {};
    for (const v of morphoVaults) {
      morphoByAddress[v.address.toLowerCase()] = v;
    }

    // Merge configured vault metadata with Morpho stats
    const merged = configuredVaults.map(v => {
      const m = morphoByAddress[v.address.toLowerCase()];
      const tvl = m?.state?.totalAssetsUsd ?? 0;
      const netApy = m?.state?.weeklyNetApy ?? m?.state?.monthlyNetApy ?? 0;
      const depositors = depositorsByVault[v.address.toLowerCase()] ?? 0;

      return {
        ...v,
        tvl,
        apy: netApy * 100, // Convert to percentage
        depositors,
        revenueAllTime: null, // Fetched in detail route
        feesAllTime: null, // Fetched in detail route
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


