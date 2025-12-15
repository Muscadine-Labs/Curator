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
        allocation {
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
            lltv
            state {
              supplyAssetsUsd
              borrowAssetsUsd
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
  lltv: string | null; // BigInt as string
  state: {
    supplyAssetsUsd: number | null;
    borrowAssetsUsd: number | null;
    liquidityAssetsUsd: number | null;
    utilization: number | null;
  } | null;
};

export type V1VaultMarketsQueryResponse = {
  vault: {
    address: string;
    state: {
      allocation: Array<{
        market: V1VaultMarketData | null;
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

  return data.vault.state.allocation
    .map((alloc) => alloc.market)
    .filter((market): market is V1VaultMarketData => market !== null);
}
