/**
 * Indexed Morpho vault positions for a wallet (V1 MetaMorpho + Vault V2).
 */

import { gql } from 'graphql-request';
import { getAddress, isAddress, type Address } from 'viem';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { morphoVaultHref } from '@/lib/morpho/morpho-app-links';
import { resolveAssetDecimals } from '@/lib/format/asset-decimals';
import { AppError } from '@/lib/utils/error-handler';
import { withFeeWrapperLabel } from '@/lib/config/vaults';

export type UserVaultPositionSummary = {
  address: Address;
  name: string;
  assetSymbol: string;
  assetDecimals: number;
  assets: bigint;
  /** Net APY in percentage points (e.g. 5.2 for 5.2%), or null. */
  apy: number | null;
  morphoHref: string;
  chainId: number;
  version: 'v1' | 'v2';
};

function toBigIntAmount(value: string | number | null | undefined): bigint {
  if (value == null) return 0n;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.trunc(value));
  }
  const cleaned = String(value).trim();
  if (!cleaned || cleaned === '0') return 0n;
  try {
    return BigInt(cleaned);
  } catch {
    return 0n;
  }
}

/** Morpho GraphQL avgNetApy is a fraction (0.05 → 5%). */
function apyToPercentPoints(avgNetApy: number | null | undefined): number | null {
  if (avgNetApy == null || !Number.isFinite(avgNetApy)) return null;
  return avgNetApy * 100;
}

type GqlV1 = {
  vault?: {
    address?: string | null;
    name?: string | null;
    chain?: { id?: number | null } | null;
    asset?: { symbol?: string | null; decimals?: number | null } | null;
    state?: { avgNetApy?: number | null } | null;
  } | null;
  state?: { assets?: string | number | null; shares?: string | number | null } | null;
};

type GqlV2 = {
  vault?: {
    address?: string | null;
    name?: string | null;
    chain?: { id?: number | null } | null;
    asset?: { symbol?: string | null; decimals?: number | null } | null;
    avgNetApy?: number | null;
  } | null;
  assets?: string | number | null;
  shares?: string | number | null;
};

function mapV1(item: GqlV1, chainId: number): UserVaultPositionSummary | null {
  const addressRaw = item.vault?.address;
  if (!addressRaw || !isAddress(addressRaw)) return null;
  const assets = toBigIntAmount(item.state?.assets);
  const shares = toBigIntAmount(item.state?.shares);
  if (assets <= 0n && shares <= 0n) return null;
  const assetSymbol = item.vault?.asset?.symbol?.trim() || 'ASSET';
  const assetDecimals = resolveAssetDecimals(
    assetSymbol,
    item.vault?.asset?.decimals ?? 18
  );
  const vaultChain = item.vault?.chain?.id ?? chainId;
  const address = getAddress(addressRaw);
  return {
    address,
    name: withFeeWrapperLabel(item.vault?.name?.trim() || address, address),
    assetSymbol,
    assetDecimals,
    assets: assets > 0n ? assets : 0n,
    apy: apyToPercentPoints(item.vault?.state?.avgNetApy),
    morphoHref: morphoVaultHref(address, vaultChain),
    chainId: vaultChain,
    version: 'v1',
  };
}

function mapV2(item: GqlV2, chainId: number): UserVaultPositionSummary | null {
  const addressRaw = item.vault?.address;
  if (!addressRaw || !isAddress(addressRaw)) return null;
  const assets = toBigIntAmount(item.assets);
  const shares = toBigIntAmount(item.shares);
  if (assets <= 0n && shares <= 0n) return null;
  const assetSymbol = item.vault?.asset?.symbol?.trim() || 'ASSET';
  const assetDecimals = resolveAssetDecimals(
    assetSymbol,
    item.vault?.asset?.decimals ?? 18
  );
  const vaultChain = item.vault?.chain?.id ?? chainId;
  const address = getAddress(addressRaw);
  return {
    address,
    name: withFeeWrapperLabel(item.vault?.name?.trim() || address, address),
    assetSymbol,
    assetDecimals,
    assets: assets > 0n ? assets : 0n,
    apy: apyToPercentPoints(item.vault?.avgNetApy),
    morphoHref: morphoVaultHref(address, vaultChain),
    chainId: vaultChain,
    version: 'v2',
  };
}

/** Active vault positions for `user` on `chainId` (indexed; may lag chain). */
export async function fetchUserVaultPositions(
  userAddress: string,
  chainId: number
): Promise<UserVaultPositionSummary[]> {
  if (!isAddress(userAddress)) {
    throw new AppError('Invalid wallet address', 400, 'INVALID_ADDRESS');
  }
  if (!Number.isFinite(chainId) || chainId <= 0) {
    throw new AppError('Invalid chainId', 400, 'INVALID_CHAIN_ID');
  }

  const query = gql`
    query UserVaultPositions($address: String!, $chainId: Int!) {
      userByAddress(address: $address, chainId: $chainId) {
        vaultPositions {
          vault {
            address
            name
            chain {
              id
            }
            asset {
              symbol
              decimals
            }
            state {
              avgNetApy
            }
          }
          state {
            assets
            shares
          }
        }
        vaultV2Positions {
          vault {
            address
            name
            chain {
              id
            }
            asset {
              symbol
              decimals
            }
            avgNetApy
          }
          assets
          shares
        }
      }
    }
  `;

  const result = await morphoGraphQLClient.request<{
    userByAddress?: {
      vaultPositions?: GqlV1[] | null;
      vaultV2Positions?: GqlV2[] | null;
    } | null;
  }>(query, { address: userAddress, chainId });

  const v1 = (result.userByAddress?.vaultPositions ?? [])
    .map((row) => mapV1(row, chainId))
    .filter((row): row is UserVaultPositionSummary => row != null);
  const v2 = (result.userByAddress?.vaultV2Positions ?? [])
    .map((row) => mapV2(row, chainId))
    .filter((row): row is UserVaultPositionSummary => row != null);

  // Prefer V2 row when the same address appears in both lists.
  const byAddress = new Map<string, UserVaultPositionSummary>();
  for (const row of v1) {
    byAddress.set(row.address.toLowerCase(), row);
  }
  for (const row of v2) {
    byAddress.set(row.address.toLowerCase(), row);
  }

  return [...byAddress.values()].sort((a, b) => {
    if (a.assets === b.assets) return a.name.localeCompare(b.name);
    return a.assets > b.assets ? -1 : 1;
  });
}
