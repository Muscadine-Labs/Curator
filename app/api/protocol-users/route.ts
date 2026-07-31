import { NextRequest, NextResponse } from 'next/server';
import { gql } from 'graphql-request';
import { getAddress } from 'viem';
import {
  getActiveVaultAddressesForStats,
  getConfiguredVaultDisplayName,
} from '@/lib/config/vaults';
import { BASE_CHAIN_ID, GRAPHQL_FIRST_LIMIT } from '@/lib/constants';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { handleApiError } from '@/lib/utils/error-handler';
import {
  createRateLimitMiddleware,
  RATE_LIMIT_REQUESTS_PER_MINUTE,
  MINUTE_MS,
} from '@/lib/utils/rate-limit';
import { mergeApiCacheHeaders } from '@/lib/api/response-cache';
import { withServerResponseCache } from '@/lib/api/server-response-cache';
import { API_CACHE_MAX_AGE_MS } from '@/lib/api/response-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type ProtocolUserVaultPosition = {
  vaultAddress: string;
  vaultName: string;
  assetSymbol: string;
  assetDecimals: number | null;
  assets: string | null;
  assetsUsd: number | null;
  shares: string | null;
};

export type ProtocolUser = {
  address: string;
  totalUsd: number;
  vaultCount: number;
  positions: ProtocolUserVaultPosition[];
};

export type ProtocolUsersResponse = {
  users: ProtocolUser[];
  totalUsers: number;
};

const V2_POSITIONS_QUERY = gql`
  query V2VaultPositions($address: String!, $chainId: Int!, $first: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      address
      name
      asset {
        symbol
        decimals
      }
      positions(first: $first) {
        items {
          user {
            address
          }
          assets
          assetsUsd
          shares
        }
      }
    }
  }
`;

type V2PositionsResponse = {
  vaultV2ByAddress?: {
    address?: string | null;
    name?: string | null;
    asset?: { symbol?: string | null; decimals?: number | null } | null;
    positions?: {
      items?: Array<{
        user?: { address?: string | null } | null;
        assets?: string | null;
        assetsUsd?: number | null;
        shares?: string | null;
      } | null> | null;
    } | null;
  } | null;
};

export async function GET(request: NextRequest) {
  const rateLimit = createRateLimitMiddleware(RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS);
  const rateLimitResult = rateLimit(request);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    );
  }

  try {
    const payload = await withServerResponseCache(
      'protocol-users-v2',
      API_CACHE_MAX_AGE_MS,
      async (): Promise<ProtocolUsersResponse> => {
        const vaults = getActiveVaultAddressesForStats();
        const byUser = new Map<string, ProtocolUser>();

        const results = await Promise.all(
          vaults.map(async (vault) => {
            const address = getAddress(vault.address);
            try {
              const data = await morphoGraphQLClient.request<V2PositionsResponse>(
                V2_POSITIONS_QUERY,
                {
                  address,
                  chainId: vault.chainId ?? BASE_CHAIN_ID,
                  first: GRAPHQL_FIRST_LIMIT,
                }
              );
              return { vault, address, data };
            } catch {
              return { vault, address, data: null as V2PositionsResponse | null };
            }
          })
        );

        for (const { vault, address, data } of results) {
          const vaultName =
            data?.vaultV2ByAddress?.name?.trim() ||
            getConfiguredVaultDisplayName(vault);
          const assetSymbol =
            data?.vaultV2ByAddress?.asset?.symbol ?? vault.assetSymbol;
          const assetDecimals = data?.vaultV2ByAddress?.asset?.decimals ?? null;
          const items = data?.vaultV2ByAddress?.positions?.items ?? [];

          for (const item of items) {
            const userAddress = item?.user?.address;
            if (!userAddress) continue;
            const key = userAddress.toLowerCase();
            // Skip null / burn addresses — not real depositors.
            if (
              key === '0x0000000000000000000000000000000000000000' ||
              key === '0x000000000000000000000000000000000000dead'
            ) {
              continue;
            }
            const assetsUsd = item.assetsUsd ?? 0;
            // Skip dust / empty positions for the directory view.
            if (
              (item.assets == null || item.assets === '0') &&
              (!assetsUsd || assetsUsd <= 0)
            ) {
              continue;
            }

            const position: ProtocolUserVaultPosition = {
              vaultAddress: address,
              vaultName,
              assetSymbol,
              assetDecimals,
              assets: item.assets ?? null,
              assetsUsd: item.assetsUsd ?? null,
              shares: item.shares ?? null,
            };

            const existing = byUser.get(key);
            if (existing) {
              existing.positions.push(position);
              existing.totalUsd += assetsUsd;
              existing.vaultCount = existing.positions.length;
            } else {
              byUser.set(key, {
                address: getAddress(userAddress),
                totalUsd: assetsUsd,
                vaultCount: 1,
                positions: [position],
              });
            }
          }
        }

        const users = Array.from(byUser.values()).sort(
          (a, b) => b.totalUsd - a.totalUsd
        );

        return { users, totalUsers: users.length };
      }
    );

    const headers = mergeApiCacheHeaders(rateLimitResult.headers, 60);
    return NextResponse.json(payload, { headers });
  } catch (error) {
    const { error: apiError, statusCode } = handleApiError(
      error,
      'Failed to fetch protocol users'
    );
    return NextResponse.json(apiError, { status: statusCode });
  }
}
