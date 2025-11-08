import type { CuratorConfig, MorphoMarketMetrics, MorphoMarketRaw } from './types';

const MAX_UTILIZATION_BEYOND = 1.1;

export function normalize01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function computeMetricsForMarket(
  market: MorphoMarketRaw,
  config: CuratorConfig,
  benchmarkSupplyRate?: number
): MorphoMarketMetrics {
  const state = market.state ?? null;

  const borrowed = Math.max(state?.borrowAssetsUsd ?? 0, 0);
  const suppliedRaw = state?.supplyAssetsUsd ?? 0;
  const supplied = suppliedRaw > 0 ? suppliedRaw : 1; // prevent divide-by-zero
  const utilization =
    state?.utilization !== null && state?.utilization !== undefined
      ? state.utilization
      : borrowed / supplied;

  const utilSafe = config.utilizationCeiling * 0.98;
  let utilizationScore = 1;

  if (utilization > utilSafe) {
    utilizationScore =
      1 - (utilization - utilSafe) / (MAX_UTILIZATION_BEYOND - utilSafe);
  }
  utilizationScore = normalize01(utilizationScore);

  const resolvedBenchmark = benchmarkSupplyRate ?? config.fallbackBenchmarkRate;
  const supplyRate = state?.supplyApy ?? 0;
  const diff = Math.abs(supplyRate - resolvedBenchmark);
  let rateAlignmentScore = Math.exp(-diff / config.rateAlignmentEps);
  rateAlignmentScore = normalize01(rateAlignmentScore);

  const tvl = state?.sizeUsd ?? suppliedRaw ?? borrowed;
  const collateralAfterShock = supplied * (1 - config.priceStressPct);
  const potentialInsolvencyUsd = Math.max(0, borrowed - collateralAfterShock);
  const insolvencyPctOfTvl = tvl > 0 ? potentialInsolvencyUsd / tvl : 1;

  let stressExposureScore =
    insolvencyPctOfTvl <= 0
      ? 1
      : 1 - insolvencyPctOfTvl / config.insolvencyTolerancePctTvl;
  stressExposureScore = normalize01(stressExposureScore);

  const availableLiquidity = Math.max(state?.liquidityAssetsUsd ?? 0, 0);
  const requiredLiquidity = config.withdrawalLiquidityMinPct * tvl;
  let withdrawalLiquidityScore =
    availableLiquidity >= requiredLiquidity
      ? 1
      : availableLiquidity / Math.max(requiredLiquidity, 1);
  withdrawalLiquidityScore = normalize01(withdrawalLiquidityScore);

  const liquidatorCapacityPostStress =
    availableLiquidity * (1 - config.liquidityStressPct);
  const debtToLiquidate = potentialInsolvencyUsd;
  let liquidationCapacityScore =
    liquidatorCapacityPostStress >= debtToLiquidate
      ? 1
      : liquidatorCapacityPostStress / Math.max(debtToLiquidate, 1);
  liquidationCapacityScore = normalize01(liquidationCapacityScore);

  const weights = config.weights;
  const aggregate =
    utilizationScore * weights.utilization +
    rateAlignmentScore * weights.rateAlignment +
    stressExposureScore * weights.stressExposure +
    withdrawalLiquidityScore * weights.withdrawalLiquidity +
    liquidationCapacityScore * weights.liquidationCapacity;

  const rating = Math.round(aggregate * 100);

  return {
    id: market.id,
    symbol: market.loanAsset?.symbol ?? 'UNKNOWN',
    utilization,
    utilizationScore,
    supplyRate: state?.supplyApy ?? null,
    borrowRate: state?.borrowApy ?? null,
    benchmarkSupplyRate: resolvedBenchmark,
    rateAlignmentScore,
    potentialInsolvencyUsd,
    insolvencyPctOfTvl,
    stressExposureScore,
    availableLiquidity,
    requiredLiquidity,
    withdrawalLiquidityScore,
    liquidatorCapacityPostStress,
    liquidationCapacityScore,
    rating,
    raw: market,
  };
}

