import type { V1VaultMarketData } from './query-v1-vault-markets';

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

// Known Chainlink oracle addresses on Base (can be expanded)
const CHAINLINK_ORACLES = new Set<string>([
  '0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1', // Chainlink ETH/USD
  '0x7f8847242a530E809E17b2dC8A3b6d3E1c9F5A8f', // Chainlink BTC/USD
  // Add more Chainlink oracle addresses as needed
]);

// Volatile collateral assets (need stricter oracle requirements)
const VOLATILE_COLLATERAL = new Set<string>([
  'BTC',
  'ETH',
  // Add more volatile assets as needed
]);

/**
 * Compute Oracle Score (0-5)
 * 
 * Inputs:
 * - oracle.address
 * - oracle.lastUpdateTimestamp
 * - collateralAsset.symbol
 * 
 * Score:
 * - 5 = Chainlink oracle AND stalenessRatio ≤ 0.5
 * - 4 = Chainlink oracle AND stalenessRatio ≤ 1.2
 * - 3 = Custom oracle AND stalenessRatio ≤ 1.0
 * - 2 = Custom oracle (stale)
 * - 1 = Fixed / opaque oracle
 * - 0 = Stale oracle + volatile collateral
 */
function computeOracleScore(market: V1VaultMarketData): number {
  const oracleAddress = market.oracleAddress;

  // If no oracle address, treat as opaque (score 1)
  if (!oracleAddress) {
    return 1;
  }

  const isChainlink = CHAINLINK_ORACLES.has(oracleAddress.toLowerCase());

  // Without timestamp, we can't check staleness, so we score based on oracle type
  // Chainlink oracles are generally more trusted even without timestamp data
  if (isChainlink) {
    return 3; // Chainlink but no timestamp - assume moderate trust
  }
  return 1; // Opaque/custom oracle without timestamp
}

/**
 * Compute LTV Score (0-5)
 * 
 * Inputs:
 * - lltv (loan-to-liquidation threshold value, as percentage)
 * - collateralAsset.symbol
 * 
 * Score:
 * - 5 = lltv ≤ 70%
 * - 4 = 70% < lltv ≤ 80%
 * - 3 = 80% < lltv ≤ 85%
 * - 2 = 85% < lltv ≤ 90%
 * - 1 = lltv > 90%
 * - 0 = high volatility AND lltv > 85%
 */
function computeLtvScore(market: V1VaultMarketData): number {
  const lltvRaw = market.lltv;
  const collateralSymbol = market.collateralAsset?.symbol || '';
  const isVolatile = VOLATILE_COLLATERAL.has(collateralSymbol.toUpperCase());

  if (!lltvRaw) {
    return 0; // No LTV = highest risk
  }

  // LTV is stored as basis points in Morpho Blue (e.g., "8500" = 85%)
  // Basis points: 1 bp = 0.01%, so 8500 bp = 85%
  // Convert basis points to percentage: divide by 100
  const lltvPercent = Number(lltvRaw) / 100;

  if (lltvPercent <= 70) {
    return 5;
  }
  if (lltvPercent <= 80) {
    return 4;
  }
  if (lltvPercent <= 85) {
    // High volatility + LTV > 85% = score 0
    if (isVolatile) {
      return 0;
    }
    return 3;
  }
  if (lltvPercent <= 90) {
    // High volatility + LTV > 85% = score 0
    if (isVolatile) {
      return 0;
    }
    return 2;
  }
  // lltv > 90%
  if (isVolatile) {
    return 0;
  }
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

  // Convert LTV from basis points to ratio for calculations
  // Basis points to ratio: divide by 10000 (e.g., 8500 -> 0.85)
  const lltvRatio = Number(lltvRaw) / 10000;

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
 * Compute all market risk scores for a V1 vault market
 */
export function computeV1MarketRiskScores(market: V1VaultMarketData): MarketRiskScores {
  const oracleScore = computeOracleScore(market);
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
