import type { V1VaultMarketData } from './query-v1-vault-markets';
import type { OracleTimestampData } from './oracle-utils';

/**
 * Market Risk Scoring for Morpho V1 - Market Level Only
 * 
 * Formula: marketRiskScore = 0.25 * liquidationHeadroomScore + 0.25 * utilizationScore + 0.25 * coverageRatioScore + 0.25 * oracleScore
 * All component scores ∈ [0, 100]
 * Final marketRiskScore ∈ [0, 100]
 * 
 * Metrics:
 * 1. Liquidation Headroom (−5% shock) - 25% weight
 * 2. Utilization - 25% weight
 * 3. Liquidation Coverage Ratio - 25% weight
 * 4. Oracle Freshness & Reliability - 25% weight
 */

// Letter Grade Mapping (0-100 scale)
export type MarketRiskGrade = 'A+' | 'A' | 'A−' | 'B+' | 'B' | 'B−' | 'C+' | 'C' | 'C−' | 'D' | 'F';

export interface MarketRiskScores {
  liquidationHeadroomScore: number; // [0, 100] - Liquidation Headroom (−5% shock)
  utilizationScore: number; // [0, 100] - Utilization
  coverageRatioScore: number; // [0, 100] - Liquidation Coverage Ratio
  oracleScore: number; // [0, 100] - Oracle Freshness & Reliability
  marketRiskScore: number; // [0, 100]
  grade: MarketRiskGrade;
}

/**
 * Compute Oracle Freshness & Reliability Score (0-100)
 * 
 * Inputs:
 * - oracleAddress
 * - oracleTimestampData (optional) - timestamp data from Chainlink oracle
 * 
 * Compute:
 * - ageSeconds = now − lastUpdateTimestamp
 * - stalenessRatio = ageSeconds / expectedHeartbeatSeconds
 * 
 * Score (continuous):
 * - 100 = Chainlink oracle with recent update (< 1 hour old)
 * - Linear decay: 100 → 80 (1-24 hours), 80 → 60 (24-168 hours), 60 → 20 (168+ hours)
 * - 20 = No oracle address or zero address (opaque/fixed oracle)
 */
function computeOracleScore(
  market: V1VaultMarketData,
  oracleTimestampData?: OracleTimestampData | null
): number {
  const oracleAddress = market.oracleAddress;

  // If no oracle address or zero address, treat as opaque (score 20)
  if (!oracleAddress || oracleAddress.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    return 20;
  }

  // If we have timestamp data from Chainlink oracle, score based on freshness
  if (oracleTimestampData?.updatedAt && oracleTimestampData.ageSeconds !== null) {
    const ageHours = oracleTimestampData.ageSeconds / 3600;
    
    // Recent update (< 1 hour) - perfect score
    if (ageHours < 1) {
      return 100;
    }
    
    // Linear decay from 100 to 80 between 1-24 hours
    if (ageHours < 24) {
      const progress = (ageHours - 1) / (24 - 1); // 0 to 1
      return 100 - (progress * 20); // 100 → 80
    }
    
    // Linear decay from 80 to 60 between 24-168 hours (1 week)
    if (ageHours < 168) {
      const progress = (ageHours - 24) / (168 - 24); // 0 to 1
      return 80 - (progress * 20); // 80 → 60
    }
    
    // Linear decay from 60 to 20 for > 168 hours
    // Cap at 20 for very stale data (e.g., > 720 hours = 30 days)
    const maxAge = 720; // 30 days
    if (ageHours >= maxAge) {
      return 20;
    }
    const progress = (ageHours - 168) / (maxAge - 168); // 0 to 1
    return 60 - (progress * 40); // 60 → 20
  }

  // Valid oracle address exists but no timestamp data available
  // This could be a custom oracle or Chainlink feed we couldn't resolve
  return 60;
}

/**
 * Compute Liquidation Headroom Score (0-100) - −5% shock
 * 
 * Inputs:
 * - lltv
 * - state.borrowAssetsUsd
 * - state.collateralAssetsUsd (must be borrower-side collateral, not supply)
 * 
 * Compute:
 * - headroom5 = collateralUsd * 0.95 * lltvRatio − borrowUsd
 * - headroomRatio5 = headroom5 / borrowUsd
 * 
 * Score (continuous):
 * - Higher headroom ratio = better score
 * - Negative headroom (underwater) = 0
 * - Positive headroom scored based on ratio
 */
function computeLiquidationHeadroomScore(market: V1VaultMarketData): number {
  const state = market.state;
  if (!state) {
    return 0; // No state data = highest risk
  }

  const lltvRaw = market.lltv;
  if (!lltvRaw) {
    return 0; // No LTV = highest risk
  }

  // Convert LTV from wei format to ratio for calculations
  // Wei to ratio: divide by 1e18 (e.g., 860000000000000000 -> 0.86)
  const lltvRatio = Number(lltvRaw) / 1e18;

  // Get USD values - MUST use collateralAssetsUsd (borrower-side collateral)
  const collateralUsd = state.collateralAssetsUsd ? Number(state.collateralAssetsUsd) : 0;
  const borrowUsd = state.borrowAssetsUsd ? Number(state.borrowAssetsUsd) : 0;

  if (borrowUsd === 0) {
    return 100; // No borrow = safest
  }

  if (collateralUsd === 0) {
    return 0; // No collateral = highest risk
  }

  // Compute headroom with -5% shock
  // headroom5 = collateralUsd * 0.95 * lltvRatio − borrowUsd
  const headroom5 = collateralUsd * 0.95 * lltvRatio - borrowUsd;
  const headroomRatio5 = headroom5 / borrowUsd;

  // If underwater (negative headroom), score is 0
  if (headroomRatio5 < 0) {
    return 0;
  }

  // Score based on headroom ratio
  // Higher headroom = better score
  // 0% headroom = 0 score
  // 10% headroom = 60 score
  // 20% headroom = 80 score
  // 30%+ headroom = 100 score
  if (headroomRatio5 >= 0.30) {
    return 100;
  } else if (headroomRatio5 >= 0.20) {
    // 20% → 30%: 80 → 100
    const progress = (headroomRatio5 - 0.20) / 0.10;
    return 80 + (progress * 20);
  } else if (headroomRatio5 >= 0.10) {
    // 10% → 20%: 60 → 80
    const progress = (headroomRatio5 - 0.10) / 0.10;
    return 60 + (progress * 20);
  } else {
    // 0% → 10%: 0 → 60
    const progress = headroomRatio5 / 0.10;
    return progress * 60;
  }
}

/**
 * Compute Utilization Score (0-100)
 * 
 * Inputs:
 * - state.supplyAssetsUsd
 * - state.borrowAssetsUsd
 * 
 * Compute:
 * - utilization = borrowUsd / supplyUsd
 * - availableLiquidityUsd = supplyUsd − borrowUsd
 * 
 * Score (continuous):
 * - 100 = utilization = 0% (perfect liquidity)
 * - Linear decay: 100 → 80 (0-70%), 80 → 60 (70-85%), 60 → 20 (85-95%), 20 → 0 (95-100%)
 */
function computeUtilizationScore(market: V1VaultMarketData): number {
  const state = market.state;
  if (!state) {
    return 0; // No state data = highest risk
  }

  // Use USD values from state
  const supplyUsd = state.supplyAssetsUsd ? Number(state.supplyAssetsUsd) : 0;
  const borrowUsd = state.borrowAssetsUsd ? Number(state.borrowAssetsUsd) : 0;

  // Use utilization from state if available, otherwise calculate
  let utilization = state.utilization;
  if (utilization === null || utilization === undefined) {
    if (supplyUsd === 0) {
      return 0; // No supply = highest risk
    }
    utilization = borrowUsd / supplyUsd;
  }

  // Clamp utilization to [0, 1]
  utilization = Math.max(0, Math.min(1, utilization));

  // Continuous scoring based on utilization
  if (utilization < 0.70) {
    // 0% → 70%: 100 → 80 (linear)
    const progress = utilization / 0.70;
    return 100 - (progress * 20);
  } else if (utilization < 0.85) {
    // 70% → 85%: 80 → 60 (linear)
    const progress = (utilization - 0.70) / (0.85 - 0.70);
    return 80 - (progress * 20);
  } else if (utilization < 0.95) {
    // 85% → 95%: 60 → 20 (linear)
    const progress = (utilization - 0.85) / (0.95 - 0.85);
    return 60 - (progress * 40);
  } else {
    // 95% → 100%: 20 → 0 (linear)
    const progress = (utilization - 0.95) / (1.0 - 0.95);
    return 20 - (progress * 20);
  }
}

/**
 * Compute Liquidation Coverage Ratio Score (0-100)
 * 
 * Inputs:
 * - Everything from Liquidation Headroom (lltv, borrowAssetsUsd, collateralAssetsUsd)
 * - Everything from Utilization (supplyAssetsUsd, borrowAssetsUsd)
 * 
 * Compute:
 * - liquidatableBorrow5 = max(0, borrowUsd − collateralUsd*0.95*lltvRatio)
 * - coverage5 = availableLiquidityUsd / liquidatableBorrow5 (cap at 1+ if desired)
 * 
 * Score (continuous):
 * - Higher coverage ratio = better score
 * - Full coverage (≥1.0) = 100
 * - Partial coverage scored based on ratio
 */
function computeCoverageRatioScore(market: V1VaultMarketData): number {
  const state = market.state;
  if (!state) {
    return 0; // No state data = highest risk
  }

  const lltvRaw = market.lltv;
  if (!lltvRaw) {
    return 0; // No LTV = highest risk
  }

  // Convert LTV from wei format to ratio for calculations
  // Wei to ratio: divide by 1e18 (e.g., 860000000000000000 -> 0.86)
  const lltvRatio = Number(lltvRaw) / 1e18;

  // Get USD values - MUST use collateralAssetsUsd (borrower-side collateral)
  const collateralUsd = state.collateralAssetsUsd ? Number(state.collateralAssetsUsd) : 0;
  const borrowUsd = state.borrowAssetsUsd ? Number(state.borrowAssetsUsd) : 0;
  const supplyUsd = state.supplyAssetsUsd ? Number(state.supplyAssetsUsd) : 0;

  // Compute available liquidity
  const availableLiquidityUsd = supplyUsd - borrowUsd;

  if (borrowUsd === 0) {
    return 100; // No borrow = safest
  }

  if (collateralUsd === 0) {
    return 0; // No collateral = highest risk
  }

  // Compute liquidatable borrow with -5% shock
  // liquidatableBorrow5 = max(0, borrowUsd − collateralUsd*0.95*lltvRatio)
  const liquidatableBorrow5 = Math.max(0, borrowUsd - collateralUsd * 0.95 * lltvRatio);

  // If no liquidations needed, perfect score
  if (liquidatableBorrow5 === 0) {
    return 100;
  }

  // Compute coverage ratio
  // coverage5 = availableLiquidityUsd / liquidatableBorrow5
  if (availableLiquidityUsd <= 0) {
    return 0; // No liquidity available = highest risk
  }

  const coverage5 = availableLiquidityUsd / liquidatableBorrow5;

  // Score based on coverage ratio
  // Full coverage (≥1.0) = 100
  // Partial coverage scored linearly
  if (coverage5 >= 1.0) {
    return 100; // Full coverage
  } else if (coverage5 >= 0.8) {
    // 80% → 100% coverage: 80 → 100 score
    const progress = (coverage5 - 0.8) / 0.2;
    return 80 + (progress * 20);
  } else if (coverage5 >= 0.5) {
    // 50% → 80% coverage: 60 → 80 score
    const progress = (coverage5 - 0.5) / 0.3;
    return 60 + (progress * 20);
  } else if (coverage5 >= 0.25) {
    // 25% → 50% coverage: 40 → 60 score
    const progress = (coverage5 - 0.25) / 0.25;
    return 40 + (progress * 20);
  } else {
    // 0% → 25% coverage: 0 → 40 score
    const progress = coverage5 / 0.25;
    return progress * 40;
  }
}

/**
 * Map market risk score to letter grade (0-100 scale)
 */
function getMarketRiskGrade(score: number): MarketRiskGrade {
  if (score >= 93) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 87) return 'A−';
  if (score >= 84) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 77) return 'B−';
  if (score >= 74) return 'C+';
  if (score >= 70) return 'C';
  if (score >= 65) return 'C−';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Apply global caps based on component scores (0-100 scale)
 */
function applyGlobalCaps(
  oracleScore: number,
  utilizationScore: number,
  coverageRatioScore: number,
  baseScore: number
): number {
  let cappedScore = baseScore;

  // oracleScore ≤ 20 ⇒ grade ≤ C+ (54)
  if (oracleScore <= 20 && cappedScore > 54) {
    cappedScore = 54; // C+ max
  }

  // utilization ≥ 95% ⇒ grade ≤ B− (60)
  // (handled in utilizationScore, but also check if utilizationScore ≤ 20)
  if (utilizationScore <= 20 && cappedScore > 60) {
    cappedScore = 60; // B− max
  }

  // Coverage ratio < 1.0 (cannot fully cover -5% shock liquidations) ⇒ grade ≤ B (68)
  // If coverage ratio score < 100, then cannot fully cover liquidations
  if (coverageRatioScore < 100 && cappedScore > 68) {
    cappedScore = 68; // B max
  }

  return cappedScore;
}

/**
 * Check if market is idle (should not be scored)
 */
export function isMarketIdle(market: V1VaultMarketData): boolean {
  return !market.lltv || !market.collateralAsset?.symbol || market.collateralAsset.symbol === 'Unknown';
}

/**
 * Compute all market risk scores for a V1 vault market
 */
export function computeV1MarketRiskScores(
  market: V1VaultMarketData,
  oracleTimestampData?: OracleTimestampData | null
): MarketRiskScores {
  const liquidationHeadroomScore = computeLiquidationHeadroomScore(market);
  const utilizationScore = computeUtilizationScore(market);
  const coverageRatioScore = computeCoverageRatioScore(market);
  const oracleScore = computeOracleScore(market, oracleTimestampData);

  // Compute base market risk score (weighted average)
  // All metrics weighted equally at 25% each
  const baseMarketRiskScore = 
    0.25 * liquidationHeadroomScore +
    0.25 * utilizationScore +
    0.25 * coverageRatioScore +
    0.25 * oracleScore;

  // Apply global caps
  const marketRiskScore = applyGlobalCaps(
    oracleScore,
    utilizationScore,
    coverageRatioScore,
    baseMarketRiskScore
  );

  // Map to letter grade
  const grade = getMarketRiskGrade(marketRiskScore);

  return {
    liquidationHeadroomScore,
    utilizationScore,
    coverageRatioScore,
    oracleScore,
    marketRiskScore,
    grade,
  };
}
