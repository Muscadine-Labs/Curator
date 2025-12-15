import type { V1VaultMarketData } from './query-v1-vault-markets';
import type { OracleTimestampData } from './oracle-utils';

/**
 * Market Risk Scoring for Morpho V1 - Market Level Only
 * 
 * Formula: marketRiskScore = 0.25 * oracleScore + 0.25 * ltvScore + 0.25 * liquidityScore + 0.25 * liquidationScore
 * All component scores ∈ [0, 5]
 * Final marketRiskScore ∈ [0, 5]
 */

// Letter Grade Mapping
export type MarketRiskGrade = 'A+' | 'A' | 'A−' | 'B+' | 'B' | 'B−' | 'C+' | 'C' | 'C−' | 'D' | 'F';

export interface MarketRiskScores {
  oracleScore: number; // [0, 5]
  ltvScore: number; // [0, 5]
  liquidityScore: number; // [0, 5]
  liquidationScore: number; // [0, 5]
  marketRiskScore: number; // [0, 5]
  grade: MarketRiskGrade;
}

/**
 * Compute Oracle Score (0-5)
 * 
 * Inputs:
 * - oracleAddress
 * - oracleTimestampData (optional) - timestamp data from Chainlink oracle
 * 
 * Score:
 * - 5 = Chainlink oracle with recent update (< 1 hour old)
 * - 4 = Chainlink oracle with fresh update (< 24 hours old)
 * - 3 = Valid oracle address exists but no timestamp data or stale (> 24 hours)
 * - 1 = No oracle address or zero address (opaque/fixed oracle)
 */
function computeOracleScore(
  market: V1VaultMarketData,
  oracleTimestampData?: OracleTimestampData | null
): number {
  const oracleAddress = market.oracleAddress;

  // If no oracle address or zero address, treat as opaque (score 1)
  if (!oracleAddress || oracleAddress.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    return 1;
  }

  // If we have timestamp data from Chainlink oracle, score based on freshness
  if (oracleTimestampData?.updatedAt && oracleTimestampData.ageSeconds !== null) {
    const ageHours = oracleTimestampData.ageSeconds / 3600;
    
    // Recent update (< 1 hour) - best score
    if (ageHours < 1) {
      return 5;
    }
    
    // Fresh update (< 24 hours) - good score
    if (ageHours < 24) {
      return 4;
    }
    
    // Stale (> 24 hours) - moderate score
    return 3;
  }

  // Valid oracle address exists but no timestamp data available
  // This could be a custom oracle or Chainlink feed we couldn't resolve
  return 3;
}

/**
 * Compute LTV Score (0-5)
 * 
 * Inputs:
 * - lltv (loan-to-liquidation threshold value, as percentage)
 * - collateralAsset.symbol
 * 
 * Score (90% is gold standard, upper bounds only):
 * - 5 = lltv = 90% (gold standard)
 * - 4 = lltv < 92% (excluding 90%)
 * - 3 = lltv < 95%
 * - 2 = lltv < 97%
 * - 1 = lltv ≥ 97%
 */
function computeLtvScore(market: V1VaultMarketData): number {
  const lltvRaw = market.lltv;

  if (!lltvRaw) {
    return 0; // No LTV = highest risk
  }

  // LTV is stored as a fraction scaled by 1e18 in Morpho Blue (e.g., "860000000000000000" = 0.86 = 86%)
  // Convert wei to percentage: divide by 1e16 (1e18 / 100)
  const lltvPercent = Number(lltvRaw) / 1e16;

  // 90% is the gold standard - score 5
  if (lltvPercent >= 89.95 && lltvPercent <= 90.05) {
    return 5;
  }

  // Upper bounds only (no lower bounds)
  if (lltvPercent < 92) {
    return 4;
  }
  if (lltvPercent < 95) {
    return 3;
  }
  if (lltvPercent < 97) {
    return 2;
  }
  
  // lltv ≥ 97%
  return 1;
}

/**
 * Compute Liquidity Score (0-5)
 * 
 * Inputs:
 * - totalSupplyAssets (or supplyAssetsUsd)
 * - totalBorrowAssets (or borrowAssetsUsd)
 * 
 * Compute:
 * utilization = totalBorrowAssets / totalSupplyAssets
 * 
 * Score:
 * - 5 = utilization < 70%
 * - 4 = 70% ≤ utilization < 85%
 * - 3 = 85% ≤ utilization < 95%
 * - 1 = utilization ≥ 95%
 * - 0 = utilization ≥ 95% AND rapidly rising rates
 * 
 * Rule: utilization ≥ 95% ⇒ max liquidityScore = 1
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
    return 5;
  }
  if (utilization < 0.85) {
    return 4;
  }
  if (utilization < 0.95) {
    return 3;
  }
  
  // utilization ≥ 95% ⇒ max liquidityScore = 1
  // TODO: Check for rapidly rising rates (would require historical data)
  // For now, assume utilization ≥ 95% = score 1
  return 1;
}

/**
 * Compute Liquidation Score (0-5)
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
 * - 5 = -10% clears fully
 * - 4 = -5% clears fully
 * - 3 = -3% clears fully
 * - 2 = partial clearing only
 * - 1 = liquidations exceed liquidity
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
    return 5; // No borrow or collateral = safest
  }

  // Stress tests
  const stressTests = [
    { shock: -0.10, targetScore: 5 }, // -10%
    { shock: -0.05, targetScore: 4 }, // -5%
    { shock: -0.03, targetScore: 3 }, // -3%
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
      return 2; // Partial but reasonable coverage
    }
    return 1; // Liquidations exceed liquidity
  }

  return 0; // Cascade likely (no liquidity, liquidation needed)
}

/**
 * Map market risk score to letter grade
 */
function getMarketRiskGrade(score: number): MarketRiskGrade {
  if (score >= 4.70) return 'A+';
  if (score >= 4.40) return 'A';
  if (score >= 4.00) return 'A−';
  if (score >= 3.70) return 'B+';
  if (score >= 3.40) return 'B';
  if (score >= 3.00) return 'B−';
  if (score >= 2.70) return 'C+';
  if (score >= 2.40) return 'C';
  if (score >= 2.00) return 'C−';
  if (score >= 1.50) return 'D';
  return 'F';
}

/**
 * Apply global caps based on component scores
 */
function applyGlobalCaps(
  oracleScore: number,
  liquidityScore: number,
  liquidationScore: number,
  baseScore: number
): number {
  let cappedScore = baseScore;

  // oracleScore ≤ 1 ⇒ grade ≤ C+
  if (oracleScore <= 1 && cappedScore > 2.70) {
    cappedScore = 2.70; // C+ max
  }

  // utilization ≥ 95% ⇒ grade ≤ B−
  // (handled in liquidityScore, but also check if liquidityScore ≤ 3)
  if (liquidityScore <= 1 && cappedScore > 3.00) {
    cappedScore = 3.00; // B− max
  }

  // -5% stress fails ⇒ grade ≤ B
  // If liquidation score < 4, then -5% stress failed
  if (liquidationScore < 4 && cappedScore > 3.40) {
    cappedScore = 3.40; // B max
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
