import type { Market } from '@morpho-org/blue-api-sdk';

/**
 * Use SDK Market type directly for type safety
 * This ensures our types stay in sync with Morpho's GraphQL schema
 */
export type MorphoMarketRaw = Market;

export type CuratorWeights = {
  utilization: number;
  rateAlignment: number;
  stressExposure: number;
  withdrawalLiquidity: number;
  liquidationCapacity: number;
};

export type CuratorConfig = {
  morphoApiUrl: string;
  utilizationCeiling: number;
  utilizationBufferHours: number;
  rateAlignmentEps: number;
  fallbackBenchmarkRate: number;
  priceStressPct: number;
  liquidityStressPct: number;
  withdrawalLiquidityMinPct: number;
  insolvencyTolerancePctTvl: number;
  weights: CuratorWeights;
};

export type MorphoMarketMetrics = {
  id: string;
  symbol: string;
  utilization: number;
  utilizationScore: number;
  supplyRate: number | null;
  borrowRate: number | null;
  benchmarkSupplyRate: number | null;
  rateAlignmentScore: number;
  potentialInsolvencyUsd: number;
  insolvencyPctOfTvl: number;
  stressExposureScore: number;
  availableLiquidity: number;
  requiredLiquidity: number;
  withdrawalLiquidityScore: number;
  liquidatorCapacityPostStress: number;
  liquidationCapacityScore: number;
  rating: number;
  raw: MorphoMarketRaw;
};

export type MorphoMarketsResponse = {
  timestamp: string;
  markets: MorphoMarketMetrics[];
};

