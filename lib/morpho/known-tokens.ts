import {
  BASE_CBBTC_ADDRESS,
  BASE_CHAIN_ID,
  BASE_USDC_ADDRESS,
  BASE_WETH_ADDRESS,
} from '@/lib/constants';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { gql } from 'graphql-request';

export type KnownTokenMeta = {
  address: string;
  symbol: string;
  decimals: number;
};

const KNOWN: Record<string, KnownTokenMeta> = {
  [BASE_USDC_ADDRESS.toLowerCase()]: {
    address: BASE_USDC_ADDRESS,
    symbol: 'USDC',
    decimals: 6,
  },
  [BASE_WETH_ADDRESS.toLowerCase()]: {
    address: BASE_WETH_ADDRESS,
    symbol: 'WETH',
    decimals: 18,
  },
  [BASE_CBBTC_ADDRESS.toLowerCase()]: {
    address: BASE_CBBTC_ADDRESS,
    symbol: 'cbBTC',
    decimals: 8,
  },
};

const gqlCache = new Map<string, KnownTokenMeta>();

const ASSET_META_QUERY = gql`
  query TokenMeta($address: String!, $chainId: Int!) {
    assetByAddress(address: $address, chainId: $chainId) {
      address
      symbol
      decimals
    }
  }
`;

const ASSET_PRICE_QUERY = gql`
  query AssetPrice($address: String!, $chainId: Int!) {
    assetByAddress(address: $address, chainId: $chainId) {
      price {
        usd
      }
    }
  }
`;

function knownTokenMeta(address: string): KnownTokenMeta | null {
  return KNOWN[address.toLowerCase()] ?? gqlCache.get(address.toLowerCase()) ?? null;
}

export async function resolveTokenMeta(
  address: string,
  chainId: number = BASE_CHAIN_ID
): Promise<KnownTokenMeta> {
  const cached = knownTokenMeta(address);
  if (cached) return cached;

  const key = `${chainId}:${address.toLowerCase()}`;
  const hit = gqlCache.get(key);
  if (hit) return hit;

  try {
    const data = await morphoGraphQLClient.request<{
      assetByAddress?: {
        address?: string | null;
        symbol?: string | null;
        decimals?: number | null;
      } | null;
    }>(ASSET_META_QUERY, { address, chainId });
    const symbol = data.assetByAddress?.symbol?.trim();
    const decimals = data.assetByAddress?.decimals;
    if (symbol && decimals != null) {
      const meta: KnownTokenMeta = {
        address,
        symbol,
        decimals,
      };
      gqlCache.set(key, meta);
      gqlCache.set(address.toLowerCase(), meta);
      return meta;
    }
  } catch {
    // fall through
  }

  const fallback: KnownTokenMeta = {
    address,
    symbol: `${address.slice(0, 6)}…`,
    decimals: 18,
  };
  gqlCache.set(key, fallback);
  return fallback;
}

const priceCache = new Map<string, number | null>();

/** Morpho-indexed USD spot for oracle comparison panels. */
export async function fetchAssetUsdPrice(
  address: string,
  chainId: number = BASE_CHAIN_ID
): Promise<number | null> {
  const key = `${chainId}:${address.toLowerCase()}`;
  if (priceCache.has(key)) return priceCache.get(key) ?? null;

  try {
    const data = await morphoGraphQLClient.request<{
      assetByAddress?: { price?: { usd?: number | null } | null } | null;
    }>(ASSET_PRICE_QUERY, { address, chainId });
    const usd = data.assetByAddress?.price?.usd;
    const value = usd != null && Number.isFinite(usd) ? usd : null;
    priceCache.set(key, value);
    return value;
  } catch {
    priceCache.set(key, null);
    return null;
  }
}
