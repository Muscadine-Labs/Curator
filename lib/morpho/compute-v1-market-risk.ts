import type { V1VaultMarketData } from './query-v1-vault-markets';
import type { OracleTimestampData } from './oracle-utils';

/**
 * Market Risk Scoring for Morpho V1 - Market Level Only
 * 
 * Formula: marketRiskScore = 0.25 * oracleScore + 0.25 * ltvScore + 0.25 * liquidityScore + 0.25 * liquidationScore
 * All component scores ∈ [0, 100]
 * Final marketRiskScore ∈ [0, 100]
 */

// Letter Grade Mapping (0-100 scale)
export type MarketRiskGrade = 'A+' | 'A' | 'A−' | 'B+' | 'B' | 'B−' | 'C+' | 'C' | 'C−' | 'D' | 'F';

export interface MarketRiskScores {
  oracleScore: number; // [0, 100]
  ltvScore: number; // [0, 100]
  liquidityScore: number; // [0, 100]
  liquidationScore: number; // [0, 100]
  marketRiskScore: number; // [0, 100]
  grade: MarketRiskGrade;
}

/**
 * Compute Oracle Score (0-100) - Continuous
 * 
 * Inputs:
 * - oracleAddress
 * - oracleTimestampData (optional) - timestamp data from Chainlink oracle
 * 
 * Score (continuous):
 * - 100 = Chainlink oracle with recent update (0 hours old)
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
 * Compute LTV Score (0-100) - Continuous
 * 
 * Inputs:
 * - lltv (loan-to-liquidation threshold value, as percentage)
 * - collateralAsset.symbol
 * 
 * Score (continuous, 90% is gold standard):
 * - 100 = lltv = 90% (gold standard)
 * - Linear decay as LTV deviates from 90%
 * - Score decreases faster above 90% than below (higher LTV = higher risk)
 */
function computeLtvScore(market: V1VaultMarketData): number {
  const lltvRaw = market.lltv;

  if (!lltvRaw) {
    return 0; // No LTV = highest risk
  }

  // LTV is stored as a fraction scaled by 1e18 in Morpho Blue (e.g., "860000000000000000" = 0.86 = 86%)
  // Convert wei to percentage: divide by 1e16 (1e18 / 100)
  const lltvPercent = Number(lltvRaw) / 1e16;

  // 90% is the gold standard - score 100
  // Use a small tolerance window for exact 90%
  if (lltvPercent >= 89.95 && lltvPercent <= 90.05) {
    return 100;
  }

  // For LTVs below 90%: gradual decrease
  // 85% → 90%, 80% → 85%, etc.
  if (lltvPercent < 90) {
    // Linear interpolation: 85% = 95, 80% = 90, 75% = 85, etc.
    // Every 5% below 90% reduces score by 5 points
    const deviation = 90 - lltvPercent;
    const score = 100 - (deviation * 1); // 1 point per 1% deviation
    return Math.max(0, Math.min(100, score));
  }

  // For LTVs above 90%: faster decrease (higher risk)
  // 90% → 92%: 100 → 80 (20 points over 2%)
  // 92% → 95%: 80 → 50 (30 points over 3%)
  // 95% → 97%: 50 → 20 (30 points over 2%)
  // 97% → 100%: 20 → 0 (20 points over 3%)
  const deviation = lltvPercent - 90;
  
  if (deviation <= 2) {
    // 90% → 92%: 100 → 80
    const progress = deviation / 2;
    return 100 - (progress * 20);
  } else if (deviation <= 5) {
    // 92% → 95%: 80 → 50
    const progress = (deviation - 2) / 3;
    return 80 - (progress * 30);
  } else if (deviation <= 7) {
    // 95% → 97%: 50 → 20
    const progress = (deviation - 5) / 2;
    return 50 - (progress * 30);
  } else {
    // 97% → 100%: 20 → 0
    const progress = Math.min(1, (deviation - 7) / 3);
    return 20 - (progress * 20);
  }
}

/**
 * Compute Liquidity Score (0-100) - Continuous
 * 
 * Inputs:
 * - totalSupplyAssets (or supplyAssetsUsd)
 * - totalBorrowAssets (or borrowAssetsUsd)
 * 
 * Compute:
 * utilization = totalBorrowAssets / totalSupplyAssets
 * 
 * Score (continuous):
 * - 100 = utilization = 0% (perfect liquidity)
 * - Linear decay: 100 → 80 (0-70%), 80 → 60 (70-85%), 60 → 20 (85-95%), 20 → 0 (95-100%)
 */
function computeLiquidityScore(market: V1VaultMarketData): number {
  const state = market.state;
  if (!state) {
    return 0; // No state data = highest risk
  }

  // Use USD values from state
  const totalSupply = state.supplyAssetsUsd ? Number(state.supplyAssetsUsd) : 0;
  const totalBorrow = state.borrowAssetsUsd ? Number(state.borrowAssetsUsd) : 0;

  // Use utilization from state if available, otherwise calculate
  let utilization = state.utilization;
  if (utilization === null || utilization === undefined) {
    if (totalSupply === 0) {
      return 0; // No supply = highest risk
    }
    utilization = totalBorrow / totalSupply;
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
 * Compute Liquidation Score (0-100) - Continuous
 * 
 * Inputs:
 * - totalCollateralAssets (or collateralAssetsUsd)
 * - totalBorrowAssets (or borrowAssetsUsd)
 * - lltv
 * 
 * Compute availableLiquidity:
 * availableLiquidity = totalSupplyAssets - totalBorrowAssets
 * 
 * Stress tests (collateral price shock):
 * -3%, -5%, -10%
 * 
 * For each shock:
 * liquidatableBorrow = max(0, totalBorrowAssets - (totalCollateralValue * (1 + shock) * lltv))
 * 
 * Score (continuous):
 * - Based on coverage ratio and shock level
 * - Interpolates between stress test thresholds
 */
function computeLiquidationScore(market: V1VaultMarketData): number {
  const state = market.state;
  if (!state) {
    return 0;
  }

  const lltvRaw = market.lltv;
  if (!lltvRaw) {
    return 0;
  }

  // Convert LTV from wei format to ratio for calculations
  // Wei to ratio: divide by 1e18 (e.g., 860000000000000000 -> 0.86)
  const lltvRatio = Number(lltvRaw) / 1e18;

  // Use USD values from state
  const totalSupplyUsd = state.supplyAssetsUsd ? Number(state.supplyAssetsUsd) : 0;
  const totalBorrowUsd = state.borrowAssetsUsd ? Number(state.borrowAssetsUsd) : 0;
  
  // For liquidation scoring, we need collateral value
  // If we don't have collateralAssetsUsd, we can estimate it from supply (market is collateral)
  // In Morpho, supply is typically the collateral side
  const totalCollateralUsd = totalSupplyUsd;

  const availableLiquidity = totalSupplyUsd - totalBorrowUsd;

  if (totalCollateralUsd === 0 || totalBorrowUsd === 0) {
    return 100; // No borrow or collateral = safest
  }

  // Calculate liquidations for different shock levels
  const calculateLiquidations = (shock: number) => {
    const collateralAfterShock = totalCollateralUsd * (1 + shock);
    const maxBorrowAfterShock = collateralAfterShock * lltvRatio;
    return Math.max(0, totalBorrowUsd - maxBorrowAfterShock);
  };

  const liquidations10 = calculateLiquidations(-0.10);
  const liquidations5 = calculateLiquidations(-0.05);
  const liquidations3 = calculateLiquidations(-0.03);

  // Calculate coverage ratio (how much of liquidations can be covered)
  const getCoverageRatio = (liquidations: number) => {
    if (liquidations <= 0) return 1; // No liquidations needed
    if (availableLiquidity <= 0) return 0; // No liquidity available
    return Math.min(1, availableLiquidity / liquidations);
  };

  const coverage10 = getCoverageRatio(liquidations10);
  const coverage5 = getCoverageRatio(liquidations5);
  const coverage3 = getCoverageRatio(liquidations3);

  // Continuous scoring based on coverage ratios
  // -10% shock: full coverage = 100, partial = interpolate
  if (coverage10 >= 1) {
    return 100; // Perfect - can handle -10% shock
  } else if (coverage10 > 0) {
    // Partial coverage for -10%: interpolate between 100 and 80
    return 100 - ((1 - coverage10) * 20);
  }

  // -5% shock: full coverage = 80, partial = interpolate
  if (coverage5 >= 1) {
    return 80; // Can handle -5% shock
  } else if (coverage5 > 0) {
    // Partial coverage for -5%: interpolate between 80 and 60
    return 80 - ((1 - coverage5) * 20);
  }

  // -3% shock: full coverage = 60, partial = interpolate
  if (coverage3 >= 1) {
    return 60; // Can handle -3% shock
  } else if (coverage3 > 0) {
    // Partial coverage for -3%: interpolate between 60 and 40
    return 60 - ((1 - coverage3) * 20);
  }

  // No coverage for any shock level
  // Score based on how much liquidity is available relative to borrow
  if (availableLiquidity > 0) {
    const coverageRatio = availableLiquidity / totalBorrowUsd;
    // Interpolate between 40 (50% coverage) and 0 (0% coverage)
    if (coverageRatio >= 0.5) {
      return 40 - ((0.5 - coverageRatio) / 0.5) * 20; // 40 → 20
    } else {
      return 20 - ((coverageRatio / 0.5) * 20); // 20 → 0
    }
  }

  return 0; // Cascade likely (no liquidity, liquidation needed)
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
  liquidityScore: number,
  liquidationScore: number,
  baseScore: number
): number {
  let cappedScore = baseScore;

  // oracleScore ≤ 20 ⇒ grade ≤ C+ (54)
  if (oracleScore <= 20 && cappedScore > 54) {
    cappedScore = 54; // C+ max
  }

  // utilization ≥ 95% ⇒ grade ≤ B− (60)
  // (handled in liquidityScore, but also check if liquidityScore ≤ 20)
  if (liquidityScore <= 20 && cappedScore > 60) {
    cappedScore = 60; // B− max
  }

  // -5% stress fails ⇒ grade ≤ B (68)
  // If liquidation score < 80, then -5% stress failed
  if (liquidationScore < 80 && cappedScore > 68) {
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
  const oracleScore = computeOracleScore(market, oracleTimestampData);
  const ltvScore = computeLtvScore(market);
  const liquidityScore = computeLiquidityScore(market);
  const liquidationScore = computeLiquidationScore(market);

  // Compute base market risk score (weighted average)
  const baseMarketRiskScore = 
    0.25 * oracleScore +
    0.25 * ltvScore +
    0.25 * liquidityScore +
    0.25 * liquidationScore;

  // Apply global caps
  const marketRiskScore = applyGlobalCaps(
    oracleScore,
    liquidityScore,
    liquidationScore,
    baseMarketRiskScore
  );

  // Map to letter grade
  const grade = getMarketRiskGrade(marketRiskScore);

  return {
    oracleScore,
    ltvScore,
    liquidityScore,
    liquidationScore,
    marketRiskScore,
    grade,
  };
}
