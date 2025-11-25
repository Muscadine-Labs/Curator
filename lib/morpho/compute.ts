import type { CuratorConfig, MorphoMarketMetrics } from './types';
import type { Market } from '@morpho-org/blue-api-sdk';
import { logger } from '@/lib/utils/logger';

// Constants for TVL-based tolerance scaling
// Larger markets can handle higher absolute insolvency due to better liquidity depth,
// more liquidators, and better price discovery mechanisms
// For very large markets ($2B+), we allow up to 35% tolerance to account for their
// ability to handle larger absolute insolvency amounts
// This prevents large, liquid markets from being unfairly penalized
const LARGE_MARKET_THRESHOLD = 50_000_000; // $50M - markets above this get special handling
const LARGE_MARKET_MAX_TOLERANCE = 0.35; // 35% for very large markets ($2B+)
const VERY_LARGE_MARKET_THRESHOLD = 100_000_000; // $100M
const ULTRA_LARGE_MARKET_THRESHOLD = 500_000_000; // $500M - more aggressive scaling for very large markets

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

  // Scale insolvency tolerance with TVL - larger markets can handle higher absolute insolvency
  // Base tolerance for small markets (<$50M), scales up for large markets ($50M+)
  // Rationale: Large markets have better liquidity depth, more liquidators, and better price discovery
  // This prevents unfairly penalizing large, liquid markets
  const baseTolerance = clamp01(config.insolvencyTolerancePctTvl);
  let insolvencyTolerancePctTvl = baseTolerance;
  
  if (tvl >= LARGE_MARKET_THRESHOLD) {
    // Special handling for very large markets ($500M+)
    // These markets can handle 20-30% insolvency exposure due to:
    // - Deep liquidity pools
    // - Multiple liquidators
    // - Better price discovery
    // - Market infrastructure and stability
    if (tvl >= ULTRA_LARGE_MARKET_THRESHOLD) {
      // For $500M+ markets, use a more lenient tolerance that scales with size
      // Base tolerance of 20% for $500M, scaling to 35% for $2B+
      // This allows large markets with 15-20% exposure to score reasonably
      const ultraLargeScale = Math.min(1, (tvl - ULTRA_LARGE_MARKET_THRESHOLD) / (VERY_LARGE_MARKET_THRESHOLD - ULTRA_LARGE_MARKET_THRESHOLD));
      const ultraLargeBaseTolerance = 0.20; // 20% base for $500M markets
      insolvencyTolerancePctTvl = ultraLargeBaseTolerance + (LARGE_MARKET_MAX_TOLERANCE - ultraLargeBaseTolerance) * ultraLargeScale;
      insolvencyTolerancePctTvl = clamp01(insolvencyTolerancePctTvl);
    } else {
      // For markets $50M-$500M, use square root scaling
      // Scale from base tolerance to 20% at $500M
      const linearScale = Math.min(1, (tvl - LARGE_MARKET_THRESHOLD) / (ULTRA_LARGE_MARKET_THRESHOLD - LARGE_MARKET_THRESHOLD));
      const sqrtScale = Math.sqrt(linearScale);
      insolvencyTolerancePctTvl = baseTolerance + (0.20 - baseTolerance) * sqrtScale; // Scale to 20% at $500M
      insolvencyTolerancePctTvl = clamp01(insolvencyTolerancePctTvl);
    }
  }
  
  // Stress exposure scoring with softer curve for large markets
  // For large markets ($50M+), use a less punitive scoring curve that allows
  // exposures up to 80% of tolerance with minimal penalty
  let stressExposureScore: number;
  if (insolvencyPctOfTvl <= 0) {
    stressExposureScore = 1;
  } else if (tvl >= LARGE_MARKET_THRESHOLD) {
    // For $1B+ markets, use a softer curve:
    // - Exposures up to 80% of tolerance: minimal penalty (score stays high)
    // - Exposures above 80%: quadratic penalty (less harsh than linear)
    const toleranceThreshold = insolvencyTolerancePctTvl * 0.8; // 80% of tolerance
    if (insolvencyPctOfTvl <= toleranceThreshold) {
      // Minimal penalty for exposures within 80% of tolerance
      const ratio = insolvencyPctOfTvl / toleranceThreshold;
      stressExposureScore = 1 - ratio * 0.1; // Max 10% penalty
    } else {
      // Quadratic penalty for exposures above 80% of tolerance
      const excessRatio = (insolvencyPctOfTvl - toleranceThreshold) / (insolvencyTolerancePctTvl - toleranceThreshold);
      stressExposureScore = 0.9 - Math.pow(excessRatio, 1.5) * 0.9; // Quadratic curve
    }
    } else {
      // For small markets (<$50M), use linear penalty (original behavior)
      stressExposureScore = 1 - insolvencyPctOfTvl / insolvencyTolerancePctTvl;
    }
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
  // For large markets ($50M+), use softer scoring as they have better liquidation infrastructure
  const liquidityStressPct = clamp01(config.liquidityStressPct);
  const liquidatorCapacityPostStress =
    availableLiquidity * (1 - liquidityStressPct);
  const debtToLiquidate = potentialInsolvencyUsd;
  let liquidationCapacityScore: number;
  if (liquidatorCapacityPostStress >= debtToLiquidate) {
    liquidationCapacityScore = 1;
  } else if (tvl >= LARGE_MARKET_THRESHOLD) {
    // For $1B+ markets, use softer scoring curve
    // Large markets have better liquidation infrastructure, so 30-50% coverage
    // should still score reasonably well
    const coverageRatio = liquidatorCapacityPostStress / Math.max(debtToLiquidate, 1);
    if (coverageRatio >= 0.5) {
      // 50%+ coverage: score 0.6-1.0 (less punitive)
      liquidationCapacityScore = 0.6 + (coverageRatio - 0.5) * 0.8; // Maps 0.5->0.6, 1.0->1.0
    } else if (coverageRatio >= 0.3) {
      // 30-50% coverage: score 0.3-0.6
      liquidationCapacityScore = 0.3 + (coverageRatio - 0.3) * 1.5; // Maps 0.3->0.3, 0.5->0.6
    } else {
      // <30% coverage: linear penalty
      liquidationCapacityScore = coverageRatio * 1.0; // Maps 0->0, 0.3->0.3
    }
    } else {
      // For small markets (<$50M), use linear scoring (original behavior)
      liquidationCapacityScore = liquidatorCapacityPostStress / Math.max(debtToLiquidate, 1);
    }
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
  
  // Log diagnostic info for markets with null ratings to help debug
  if (insufficientTvl) {
    logger.debug('Market has insufficient TVL for rating', {
      marketId: market.id,
      symbol: market.loanAsset?.symbol,
      tvlUsd: tvl,
      minTvlUsd,
      suppliedRaw,
      borrowed,
      sizeUsd: state?.sizeUsd,
    });
  }

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

