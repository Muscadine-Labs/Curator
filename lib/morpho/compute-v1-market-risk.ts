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
 * Compute Oracle Score (0-100)
 * 
 * Inputs:
 * - oracleAddress
 * - oracleTimestampData (optional) - timestamp data from Chainlink oracle
 * 
 * Score:
 * - 100 = Chainlink oracle with recent update (< 1 hour old)
 * - 80 = Chainlink oracle with fresh update (< 24 hours old)
 * - 60 = Valid oracle address exists but no timestamp data or stale (> 24 hours)
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
    
    // Recent update (< 1 hour) - best score
    if (ageHours < 1) {
      return 100;
    }
    
    // Fresh update (< 24 hours) - good score
    if (ageHours < 24) {
      return 80;
    }
    
    // Stale (> 24 hours) - moderate score
    return 60;
  }

  // Valid oracle address exists but no timestamp data available
  // This could be a custom oracle or Chainlink feed we couldn't resolve
  return 60;
}

/**
 * Compute LTV Score (0-100)
 * 
 * Inputs:
 * - lltv (loan-to-liquidation threshold value, as percentage)
 * - collateralAsset.symbol
 * 
 * Score (90% is gold standard, upper bounds only):
 * - 100 = lltv = 90% (gold standard)
 * - 80 = lltv < 92% (excluding 90%)
 * - 60 = lltv < 95%
 * - 40 = lltv < 97%
 * - 20 = lltv ≥ 97%
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
  if (lltvPercent >= 89.95 && lltvPercent <= 90.05) {
    return 100;
  }

  // Upper bounds only (no lower bounds)
  if (lltvPercent < 92) {
    return 80;
  }
  if (lltvPercent < 95) {
    return 60;
  }
  if (lltvPercent < 97) {
    return 40;
  }
  
  // lltv ≥ 97%
  return 20;
}

/**
 * Compute Liquidity Score (0-100)
 * 
 * Inputs:
 * - totalSupplyAssets (or supplyAssetsUsd)
 * - totalBorrowAssets (or borrowAssetsUsd)
 * 
 * Compute:
 * utilization = totalBorrowAssets / totalSupplyAssets
 * 
 * Score:
 * - 100 = utilization < 70%
 * - 80 = 70% ≤ utilization < 85%
 * - 60 = 85% ≤ utilization < 95%
 * - 20 = utilization ≥ 95%
 * - 0 = utilization ≥ 95% AND rapidly rising rates
 * 
 * Rule: utilization ≥ 95% ⇒ max liquidityScore = 20
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

  if (utilization < 0.70) {
    return 100;
  }
  if (utilization < 0.85) {
    return 80;
  }
  if (utilization < 0.95) {
    return 60;
  }
  
  // utilization ≥ 95% ⇒ max liquidityScore = 20
  // TODO: Check for rapidly rising rates (would require historical data)
  // For now, assume utilization ≥ 95% = score 20
  return 20;
}

/**
 * Compute Liquidation Score (0-100)
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
 * Score:
 * - 100 = -10% clears fully
 * - 80 = -5% clears fully
 * - 60 = -3% clears fully
 * - 40 = partial clearing only
 * - 20 = liquidations exceed liquidity
 * - 0 = cascade likely
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

  // Stress tests
  const stressTests = [
    { shock: -0.10, targetScore: 100 }, // -10%
    { shock: -0.05, targetScore: 80 }, // -5%
    { shock: -0.03, targetScore: 60 }, // -3%
  ];

  for (const test of stressTests) {
    const collateralAfterShock = totalCollateralUsd * (1 + test.shock);
    const maxBorrowAfterShock = collateralAfterShock * lltvRatio;
    const liquidatableBorrow = Math.max(0, totalBorrowUsd - maxBorrowAfterShock);

    // If no liquidation needed, this stress test passes
    if (liquidatableBorrow <= 0) {
      return test.targetScore;
    }

    // Check if available liquidity can cover liquidations
    if (liquidatableBorrow <= availableLiquidity) {
      // Full clearing possible
      return test.targetScore;
    }
  }

  // Partial clearing only (some liquidation needed but liquidity available)
  if (availableLiquidity > 0) {
    const coverageRatio = availableLiquidity / totalBorrowUsd;
    if (coverageRatio >= 0.5) {
      return 40; // Partial but reasonable coverage
    }
    return 20; // Liquidations exceed liquidity
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
