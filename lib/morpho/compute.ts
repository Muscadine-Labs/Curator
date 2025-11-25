import type { CuratorConfig, MorphoMarketMetrics } from './types';
import type { Market } from '@morpho-org/blue-api-sdk';
import { logger } from '@/lib/utils/logger';

/**
 * Clamps a value to [0, 1] range
 */
function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export function normalize01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function computeMetricsForMarket(
  market: Market,
  config: CuratorConfig,
  benchmarkSupplyRate?: number
): MorphoMarketMetrics {
  const state = market.state ?? null;

  const suppliedRaw = Math.max(state?.supplyAssetsUsd ?? 0, 0);
  const borrowed = Math.max(state?.borrowAssetsUsd ?? 0, 0);
  const supplied = suppliedRaw > 0 ? suppliedRaw : 1; // prevent divide-by-zero
  const utilization =
    state?.utilization !== null && state?.utilization !== undefined
      ? state.utilization
      : borrowed / supplied;

  // TVL computation with proper fallback
  const tvl =
    state?.sizeUsd && state.sizeUsd > 0
      ? state.sizeUsd
      : suppliedRaw + borrowed;

  const minTvlUsd = config.minTvlUsd ?? 10_000;
  const minTvlThresholdHit = tvl < minTvlUsd;
  const insufficientTvl = minTvlThresholdHit;

  // Utilization scoring with configurable maxUtilizationBeyond
  const maxUtilizationBeyond = config.maxUtilizationBeyond ?? 1.1;
  const utilSafe = clamp01(config.utilizationCeiling) * 0.98;
  let utilizationScore = 1;

  if (utilization > utilSafe) {
    utilizationScore =
      1 - (utilization - utilSafe) / (maxUtilizationBeyond - utilSafe);
  }
  utilizationScore = normalize01(utilizationScore);

  // Runtime sanity check for utilization anomalies
  if (utilization > maxUtilizationBeyond + 0.05) {
    logger.warn('Utilization anomaly detected', {
      marketId: market.id,
      utilization,
      maxUtilizationBeyond,
      threshold: maxUtilizationBeyond + 0.05,
    });
  }

  // Rate alignment scoring
  const resolvedBenchmark = benchmarkSupplyRate ?? config.fallbackBenchmarkRate;
  const supplyRate = state?.supplyApy ?? 0;
  const diff = Math.abs(supplyRate - resolvedBenchmark);
  let rateAlignmentScore = Math.exp(-diff / config.rateAlignmentEps);
  
  // Optional: extra penalty if yield is "too high" relative to benchmark
  // TODO: Consider asymmetric penalty when market yields way above benchmark
  const highYieldBuffer = config.rateAlignmentHighYieldBuffer ?? 0.03;
  const highYieldEps = config.rateAlignmentHighYieldEps ?? 0.01;
  if (supplyRate > resolvedBenchmark + highYieldBuffer) {
    const excess = supplyRate - (resolvedBenchmark + highYieldBuffer);
    rateAlignmentScore *= Math.exp(-excess / highYieldEps);
  }
  rateAlignmentScore = normalize01(rateAlignmentScore);

  // Stress model safety with clamped config values
  const priceStressPct = clamp01(config.priceStressPct);
  const collateralAfterShock = Math.max(
    supplied * (1 - priceStressPct),
    0
  );
  const potentialInsolvencyUsd = Math.max(0, borrowed - collateralAfterShock);
  const insolvencyPctOfTvl = tvl > 0 ? potentialInsolvencyUsd / tvl : 1;

  const insolvencyTolerancePctTvl = clamp01(config.insolvencyTolerancePctTvl);
  let stressExposureScore =
    insolvencyPctOfTvl <= 0
      ? 1
      : 1 - insolvencyPctOfTvl / insolvencyTolerancePctTvl;
  stressExposureScore = normalize01(stressExposureScore);

  // Withdrawal liquidity scoring with clamped config
  const availableLiquidity = Math.max(state?.liquidityAssetsUsd ?? 0, 0);
  const withdrawalLiquidityMinPct = clamp01(config.withdrawalLiquidityMinPct);
  const requiredLiquidity = withdrawalLiquidityMinPct * tvl;
  let withdrawalLiquidityScore =
    availableLiquidity >= requiredLiquidity
      ? 1
      : availableLiquidity / Math.max(requiredLiquidity, 1);
  withdrawalLiquidityScore = normalize01(withdrawalLiquidityScore);

  // Liquidation capacity scoring with clamped config
  const liquidityStressPct = clamp01(config.liquidityStressPct);
  const liquidatorCapacityPostStress =
    availableLiquidity * (1 - liquidityStressPct);
  const debtToLiquidate = potentialInsolvencyUsd;
  let liquidationCapacityScore =
    liquidatorCapacityPostStress >= debtToLiquidate
      ? 1
      : liquidatorCapacityPostStress / Math.max(debtToLiquidate, 1);
  liquidationCapacityScore = normalize01(liquidationCapacityScore);

  // Aggregate rating (weights already normalized in mergeConfig)
  const weights = config.weights;
  const aggregate =
    utilizationScore * weights.utilization +
    rateAlignmentScore * weights.rateAlignment +
    stressExposureScore * weights.stressExposure +
    withdrawalLiquidityScore * weights.withdrawalLiquidity +
    liquidationCapacityScore * weights.liquidationCapacity;

  // Return null rating for insufficient TVL markets, otherwise round to 0-100
  const rating = insufficientTvl ? null : Math.round(aggregate * 100);

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
    tvlUsd: tvl,
    minTvlThresholdHit,
    insufficientTvl,
    effectiveWeights: weights,
    rating,
    configVersion: config.configVersion,
    raw: market,
  };
}

