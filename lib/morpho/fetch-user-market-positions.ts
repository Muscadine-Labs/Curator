/**
 * Indexed Morpho Blue market positions for a wallet (GraphQL).
 */

import { gql } from 'graphql-request';
import { isAddress, type Hex } from 'viem';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { formatLltvPercent } from '@/lib/morpho/blue-create-market';
import { AppError } from '@/lib/utils/error-handler';

export type UserMarketPositionSummary = {
  marketId: Hex;
  pair: string;
  loanSymbol: string;
  loanDecimals: number;
  collateralSymbol: string;
  collateralDecimals: number;
  lltvLabel: string;
  supplyAssets: bigint;
  borrowAssets: bigint;
  collateral: bigint;
};

type GqlAsset = { symbol?: string | null; decimals?: number | null } | null;
type GqlState = {
  supplyAssets?: string | number | null;
  borrowAssets?: string | number | null;
  collateral?: string | number | null;
} | null;

type GqlItem = {
  market?: {
    marketId?: string | null;
    lltv?: string | number | null;
    loanAsset?: GqlAsset;
    collateralAsset?: GqlAsset;
  } | null;
  state?: GqlState;
};

function toBigIntAmount(value: string | number | null | undefined): bigint {
  if (value == null) return 0n;
  if (typeof value === 'bigint') return value;
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

function mapItem(item: GqlItem): UserMarketPositionSummary | null {
  const marketId = item.market?.marketId;
  if (!marketId || !/^0x[a-fA-F0-9]{64}$/.test(marketId)) return null;

  const loanSymbol = item.market?.loanAsset?.symbol?.trim() || 'LOAN';
  const collateralSymbol = item.market?.collateralAsset?.symbol?.trim() || 'COLL';
  const loanDecimals = Number(item.market?.loanAsset?.decimals ?? 18);
  const collateralDecimals = Number(item.market?.collateralAsset?.decimals ?? 18);
  const supplyAssets = toBigIntAmount(item.state?.supplyAssets);
  const borrowAssets = toBigIntAmount(item.state?.borrowAssets);
  const collateral = toBigIntAmount(item.state?.collateral);

  if (supplyAssets === 0n && borrowAssets === 0n && collateral === 0n) return null;

  const lltvRaw = item.market?.lltv;
  const lltv =
    lltvRaw != null && String(lltvRaw).trim() !== ''
      ? toBigIntAmount(lltvRaw)
      : 0n;

  return {
    marketId: marketId as Hex,
    pair: `${collateralSymbol}/${loanSymbol}`,
    loanSymbol,
    loanDecimals: Number.isFinite(loanDecimals) ? loanDecimals : 18,
    collateralSymbol,
    collateralDecimals: Number.isFinite(collateralDecimals) ? collateralDecimals : 18,
    lltvLabel: lltv > 0n ? formatLltvPercent(lltv) : '—',
    supplyAssets,
    borrowAssets,
    collateral,
  };
}

/** Active Blue market positions for `user` on `chainId` (indexed; may lag chain). */
export async function fetchUserMarketPositions(
  userAddress: string,
  chainId: number
): Promise<UserMarketPositionSummary[]> {
  if (!isAddress(userAddress)) {
    throw new AppError('Invalid wallet address', 400, 'INVALID_ADDRESS');
  }
  if (!Number.isFinite(chainId) || chainId <= 0) {
    throw new AppError('Invalid chainId', 400, 'INVALID_CHAIN_ID');
  }

  const query = gql`
    query UserMarketPositions($address: String!, $chainId: Int!) {
      userByAddress(address: $address, chainId: $chainId) {
        marketPositions {
          market {
            marketId
            lltv
            loanAsset {
              symbol
              decimals
            }
            collateralAsset {
              symbol
              decimals
            }
          }
          state {
            supplyAssets
            borrowAssets
            collateral
          }
        }
      }
    }
  `;

  const result = await morphoGraphQLClient.request<{
    userByAddress?: { marketPositions?: GqlItem[] | null } | null;
  }>(query, { address: userAddress, chainId });

  const items = result.userByAddress?.marketPositions ?? [];
  const mapped = items
    .map(mapItem)
    .filter((row): row is UserMarketPositionSummary => row != null);

  mapped.sort((a, b) => {
    const aScore = a.borrowAssets + a.collateral + a.supplyAssets;
    const bScore = b.borrowAssets + b.collateral + b.supplyAssets;
    if (aScore === bScore) return a.pair.localeCompare(b.pair);
    return aScore > bScore ? -1 : 1;
  });

  return mapped;
}
