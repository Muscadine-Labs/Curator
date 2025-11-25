import { gql, request } from 'graphql-request';
import { mergeConfig } from './config';
import type { CuratorConfig, MorphoMarketRaw } from './types';
import { BASE_CHAIN_ID } from '@/lib/constants';

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

export async function fetchMorphoMarkets(
  limit = 200,
  config?: CuratorConfig,
  chainIds: number[] = [BASE_CHAIN_ID] // Default to Base chain
): Promise<MorphoMarketRaw[]> {
  const effectiveConfig = config ?? mergeConfig();

  const data = await request<{
    markets: { items: MorphoMarketRaw[] | null } | null;
  }>(
    effectiveConfig.morphoApiUrl,
    MARKETS_QUERY,
    { first: limit, chainIds }
  );

  return data.markets?.items?.filter(Boolean) ?? [];
}

