import { gql, request } from 'graphql-request';
import { mergeConfig } from './config';
import type { CuratorConfig, MorphoMarketRaw } from './types';

const MARKETS_QUERY = gql`
  query MorphoMarkets($first: Int!) {
    markets(first: $first) {
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
  config?: CuratorConfig
): Promise<MorphoMarketRaw[]> {
  const effectiveConfig = config ?? mergeConfig();

  const data = await request<{
    markets: { items: MorphoMarketRaw[] | null } | null;
  }>(
    effectiveConfig.morphoApiUrl,
    MARKETS_QUERY,
    { first: limit }
  );

  return data.markets?.items?.filter(Boolean) ?? [];
}

