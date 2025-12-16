import { gql } from 'graphql-request';
import { morphoGraphQLClient } from './graphql-client';
import { BASE_CHAIN_ID } from '@/lib/constants';

/**
 * GraphQL query to fetch markets for a V1 vault with all fields needed for market risk scoring
 */
const VAULT_V1_MARKETS_QUERY = gql`
  query VaultV1Markets($address: String!, $chainId: Int!) {
    vault: vaultByAddress(address: $address, chainId: $chainId) {
      address
      state {
        totalAssetsUsd
        allocation {
          supplyAssets
          supplyAssetsUsd
          market {
            id
            uniqueKey
            loanAsset {
              symbol
              decimals
              address
            }
            collateralAsset {
              symbol
              decimals
              address
            }
            oracleAddress
            oracle {
              id
              address
              type
            }
            lltv
            state {
              supplyAssetsUsd
              borrowAssetsUsd
              collateralAssetsUsd
              liquidityAssetsUsd
              utilization
            }
          }
        }
      }
    }
  }
`;

/**
 * Type definitions for V1 vault markets query response
 */
export type V1VaultMarketData = {
  id: string;
  uniqueKey: string;
  loanAsset: {
    symbol: string;
    decimals: number;
    address: string;
  };
  collateralAsset: {
    symbol: string;
    decimals: number;
    address: string;
  };
  oracleAddress: string | null;
  oracle: {
    id: string;
    address: string;
    type: string; // e.g., "ChainlinkOracleV2"
  } | null;
  lltv: string | null; // BigInt as string
  state: {
    supplyAssetsUsd: number | null;
    borrowAssetsUsd: number | null;
    collateralAssetsUsd: number | null;
    liquidityAssetsUsd: number | null;
    utilization: number | null;
  } | null;
  // Vault allocation data for this market
  vaultSupplyAssets: string | null; // Raw amount supplied by vault
  vaultSupplyAssetsUsd: number | null; // USD value of vault supply
  vaultTotalAssetsUsd: number | null; // Total vault assets for percentage calculation
  marketTotalSupplyUsd: number | null; // Total market supply for market share calculation
};

export type V1VaultMarketsQueryResponse = {
  vault: {
    address: string;
    state: {
      totalAssetsUsd: number | null;
      allocation: Array<{
        supplyAssets: string | null;
        supplyAssetsUsd: number | null;
        market: {
          id: string;
          uniqueKey: string;
          loanAsset: {
            symbol: string;
            decimals: number;
            address: string;
          } | null;
          collateralAsset: {
            symbol: string;
            decimals: number;
            address: string;
          } | null;
          oracleAddress: string | null;
          oracle: {
            id: string;
            address: string;
            type: string;
          } | null;
          lltv: string | null;
          state: {
            supplyAssetsUsd: number | null;
            borrowAssetsUsd: number | null;
            collateralAssetsUsd: number | null;
            liquidityAssetsUsd: number | null;
            utilization: number | null;
          } | null;
        } | null;
      }> | null;
    } | null;
  } | null;
};

/**
 * Fetch markets for a V1 vault
 */
export async function fetchV1VaultMarkets(
  vaultAddress: string,
  chainId: number = BASE_CHAIN_ID
): Promise<V1VaultMarketData[]> {
  const data = await morphoGraphQLClient.request<V1VaultMarketsQueryResponse>(
    VAULT_V1_MARKETS_QUERY,
    { address: vaultAddress, chainId }
  );

  if (!data.vault?.state?.allocation) {
    return [];
  }

  const vaultTotalAssetsUsd = data.vault.state.totalAssetsUsd ?? 0;

  return data.vault.state.allocation
    .map((alloc) => {
      if (!alloc.market) return null;

      const market: V1VaultMarketData = {
        id: alloc.market.id,
        uniqueKey: alloc.market.uniqueKey,
        loanAsset: alloc.market.loanAsset || { symbol: 'Unknown', decimals: 18, address: '' },
        collateralAsset: alloc.market.collateralAsset || { symbol: 'Unknown', decimals: 18, address: '' },
        oracleAddress: alloc.market.oracleAddress,
        oracle: alloc.market.oracle
          ? {
              id: alloc.market.oracle.id,
              address: alloc.market.oracle.address,
              type: alloc.market.oracle.type,
            }
          : null,
        lltv: alloc.market.lltv,
        state: alloc.market.state,
        vaultSupplyAssets: alloc.supplyAssets,
        vaultSupplyAssetsUsd: alloc.supplyAssetsUsd ?? null,
        vaultTotalAssetsUsd,
        marketTotalSupplyUsd: alloc.market.state?.supplyAssetsUsd ?? null,
      };

      return market;
    })
    .filter((market): market is V1VaultMarketData => market !== null);
}
