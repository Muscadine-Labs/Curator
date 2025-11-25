import { gql } from 'graphql-request';
import { mergeConfig } from './config';
import type { CuratorConfig } from './types';
import { BASE_CHAIN_ID } from '@/lib/constants';
import { morphoGraphQLClient } from './graphql-client';
import type { Market, QueryMarketsArgs, Maybe } from '@morpho-org/blue-api-sdk';

const MARKETS_QUERY = gql`
  query MorphoMarkets($first: Int!, $chainIds: [Int!]) {
    markets(first: $first, where: { chainId_in: $chainIds }) {
      items {
        id
        uniqueKey
        loanAsset {
          symbol
          decimals
        }
        collateralAsset {
          symbol
          decimals
        }
        state {
          supplyAssetsUsd
          borrowAssetsUsd
          liquidityAssetsUsd
          sizeUsd
          supplyApy
          borrowApy
          utilization
        }
      }
    }
  }
`;

/**
 * Response type for markets query matching our query structure
 */
type MarketsQueryResponse = {
  markets: {
    items: Maybe<Market>[] | null;
  } | null;
};

/**
 * Fetch Morpho markets using SDK types for type safety
 */
export async function fetchMorphoMarkets(
  limit = 200,
  config?: CuratorConfig,
  chainIds: number[] = [BASE_CHAIN_ID] // Default to Base chain
): Promise<Market[]> {
  const effectiveConfig = config ?? mergeConfig();

  const data = await morphoGraphQLClient.request<MarketsQueryResponse>(
    MARKETS_QUERY,
    { first: limit, chainIds } as QueryMarketsArgs
  );

  return data.markets?.items?.filter((item): item is Market => item !== null) ?? [];
}

