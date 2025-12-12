import { NextResponse } from 'next/server';
import { vaultAddresses } from '@/lib/config/vaults';
import { BASE_CHAIN_ID, GRAPHQL_FIRST_LIMIT } from '@/lib/constants';
import { handleApiError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { gql } from 'graphql-request';
import { getAddress } from 'viem';


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
    // Get all configured vault addresses (checksummed for GraphQL)
    const addresses = vaultAddresses.map(v => getAddress(v.address));

    // Build queries for both V1 and V2 vaults
    const v1Query = gql`
      query FetchV1Vaults($addresses: [String!]) {
        vaults(
          first: ${GRAPHQL_FIRST_LIMIT}
          where: { address_in: $addresses, chainId_in: [${BASE_CHAIN_ID}] }
        ) {
          items {
            address
            name
            symbol
            whitelisted
            asset { address symbol decimals }
            state {
              totalAssetsUsd
              weeklyNetApy
              monthlyNetApy
              fee
            }
          }
        }
      }
    `;

    // For V2 vaults, we need to query individually since there's no vaultsV2 list query
    // We'll fetch V2 vaults by trying each address with vaultV2ByAddress
    const v2VaultPromises = addresses.map(async (address) => {
      try {
        const v2Query = gql`
          query FetchV2Vault($address: String!, $chainId: Int!) {
            vaultV2ByAddress(address: $address, chainId: $chainId) {
              address
              name
              symbol
              whitelisted
              asset { address symbol decimals }
              performanceFee
              totalAssetsUsd
              avgApy
              avgNetApy
            }
          }
        `;
        const result = await morphoGraphQLClient.request<{ vaultV2ByAddress?: { address: string; name: string; symbol?: string; whitelisted?: boolean; asset?: { address?: string; symbol?: string; decimals?: number }; performanceFee?: number; totalAssetsUsd?: number; avgApy?: number; avgNetApy?: number } | null }>(v2Query, { address, chainId: BASE_CHAIN_ID });
        return result.vaultV2ByAddress;
      } catch {
        return null;
      }
    });

    // Fetch V1 vaults and V2 vaults in parallel
    const [v1Data, v2Results] = await Promise.all([
      morphoGraphQLClient.request<{ vaults?: { items?: Array<{ address: string; name: string; whitelisted?: boolean; asset?: { address?: string; symbol?: string; decimals?: number }; state?: { totalAssetsUsd?: number; weeklyNetApy?: number; monthlyNetApy?: number; fee?: number } } | null> | null } | null }>(v1Query, { addresses }).catch(() => ({ vaults: { items: [] } })),
      Promise.all(v2VaultPromises),
    ]);

    const v2Vaults = v2Results.filter((v): v is NonNullable<typeof v> => v !== null);

    // Fetch positions for all vaults
    const positionsQuery = gql`
      query FetchPositions($addresses: [String!]) {
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

    const positionsData = await morphoGraphQLClient.request<{ vaultPositions?: { items?: Array<{ vault?: { address?: string } | null; user?: { address?: string } | null } | null> | null } | null }>(positionsQuery, { addresses }).catch(() => ({ vaultPositions: { items: [] } }));

    const v1Vaults = (v1Data.vaults?.items?.filter((v): v is NonNullable<typeof v> => v !== null) ?? []) as Array<{ address: string; name: string; symbol?: string; whitelisted?: boolean; asset?: { address?: string; symbol?: string; decimals?: number }; state?: { totalAssetsUsd?: number; weeklyNetApy?: number; monthlyNetApy?: number; fee?: number } | null }>;
    const positions = (positionsData.vaultPositions?.items?.filter((p): p is NonNullable<typeof p> => p !== null) ?? []) as Array<{ vault?: { address?: string } | null; user?: { address?: string } | null }>;

    // Compute depositors per vault
    const depositorsByVault: Record<string, number> = {};
    for (const pos of positions) {
      if (!pos) continue;
      const addr = pos.vault?.address?.toLowerCase();
      if (addr) {
        depositorsByVault[addr] = (depositorsByVault[addr] || 0) + 1;
      }
    }

    // Combine and format vaults from GraphQL
    const allVaults = [
      ...v1Vaults.map(v => ({
        address: v.address,
        name: v.name || 'Unknown Vault',
        symbol: v.symbol || v.asset?.symbol || 'UNKNOWN',
        asset: v.asset?.symbol || 'UNKNOWN',
        chainId: BASE_CHAIN_ID,
        scanUrl: `https://basescan.org/address/${v.address}`,
        performanceFeeBps: v.state?.fee ? Math.round(v.state.fee * 10000) : null,
        status: v.whitelisted ? 'active' as const : 'paused' as const,
        riskTier: 'medium' as const,
        createdAt: new Date().toISOString(),
        tvl: v.state?.totalAssetsUsd ?? null,
        apy: (v.state?.weeklyNetApy ?? v.state?.monthlyNetApy ?? 0) * 100,
        depositors: depositorsByVault[v.address.toLowerCase()] ?? 0,
        revenueAllTime: null,
        feesAllTime: null,
        lastHarvest: null,
      })),
      ...v2Vaults.map(v => ({
        address: v.address,
        name: v.name || 'Unknown Vault',
        symbol: v.symbol || v.asset?.symbol || 'UNKNOWN',
        asset: v.asset?.symbol || 'UNKNOWN',
        chainId: BASE_CHAIN_ID,
        scanUrl: `https://basescan.org/address/${v.address}`,
        performanceFeeBps: v.performanceFee ? Math.round(v.performanceFee * 10000) : null,
        status: v.whitelisted ? 'active' as const : 'paused' as const,
        riskTier: 'medium' as const,
        createdAt: new Date().toISOString(),
        tvl: v.totalAssetsUsd ?? null,
        apy: (v.avgNetApy ?? v.avgApy ?? 0) * 100,
        depositors: depositorsByVault[v.address.toLowerCase()] ?? 0,
        revenueAllTime: null,
        feesAllTime: null,
        lastHarvest: null,
      })),
    ];

    // Filter to only include vaults from our configured addresses
    const configuredAddresses = new Set(vaultAddresses.map(v => v.address.toLowerCase()));
    const merged = allVaults.filter(v => configuredAddresses.has(v.address.toLowerCase()));

    const responseHeaders = new Headers(rateLimitResult.headers);
    responseHeaders.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    return NextResponse.json(merged, { headers: responseHeaders });
  } catch (err) {
    const { error, statusCode } = handleApiError(err, 'Failed to fetch vaults');
    return NextResponse.json(error, { status: statusCode });
  }
}


