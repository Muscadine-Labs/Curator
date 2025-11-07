export type MorphoMarketRaw = {
  id: string;
  loanAsset: {
    symbol: string;
    decimals: number;
  } | null;
  collateralAsset: {
    symbol: string;
    decimals: number;
  } | null;
  state: {
    supplyAssetsUsd: number | null;
    borrowAssetsUsd: number | null;
    liquidityAssetsUsd: number | null;
    sizeUsd: number | null;
    supplyApy: number | null;
    borrowApy: number | null;
    utilization: number | null;
  } | null;
};

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

