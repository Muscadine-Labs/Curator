import { mergeConfig, type CuratorConfigOverrides } from './config';
import { computeMetricsForMarket } from './compute';
import { fetchMorphoMarkets } from './query';
import type { MorphoMarketMetrics } from './types';
import type { Market } from '@morpho-org/blue-api-sdk';

type RatingOptions = {
  limit?: number;
  marketId?: string;
  configOverride?: CuratorConfigOverrides;
  benchmarkRates?: Record<string, number>;
};

function applyBenchmark(
  market: Market,
  benchmarkRates?: Record<string, number>,
  fallback?: number
): number | undefined {
  if (!benchmarkRates) return fallback;
  const symbol = market.loanAsset?.symbol?.toUpperCase();
  if (!symbol) return fallback;
  const rate = benchmarkRates[symbol];
  return typeof rate === 'number' ? rate : fallback;
}

export async function getMorphoMarketRatings(
  options: RatingOptions = {}
): Promise<MorphoMarketMetrics[]> {
  const { limit = 500, marketId, configOverride, benchmarkRates } = options;
  const config = mergeConfig(configOverride);
  const rawMarkets = await fetchMorphoMarkets(limit, config);

  const filtered = marketId
    ? rawMarkets.filter((market) => 
        market.id === marketId || market.uniqueKey === marketId
      )
    : rawMarkets;

  const metrics = filtered.map((market) =>
    computeMetricsForMarket(
      market,
      config,
      applyBenchmark(market, benchmarkRates, config.fallbackBenchmarkRate)
    )
  );

  return metrics.sort((a, b) => b.rating - a.rating);
}

export function groupMarketsByUnderlying(
  markets: MorphoMarketMetrics[]
): Record<string, MorphoMarketMetrics[]> {
  return markets.reduce<Record<string, MorphoMarketMetrics[]>>((acc, market) => {
    const symbol = market.symbol?.toUpperCase() || 'UNKNOWN';
    if (!acc[symbol]) acc[symbol] = [];
    acc[symbol].push(market);
    return acc;
  }, {});
}

