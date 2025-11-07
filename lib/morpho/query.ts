import { gql, request } from 'graphql-request';
import { mergeConfig } from './config';
import type { CuratorConfig, MorphoMarketRaw } from './types';

const MARKETS_QUERY = gql`
  query MorphoMarkets($first: Int!, $chainIds: [Int!]) {
    markets(first: $first, where: { chainId_in: $chainIds }) {
      items {
        id
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
  chainIds: number[] = [8453] // Default to Base chain
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

