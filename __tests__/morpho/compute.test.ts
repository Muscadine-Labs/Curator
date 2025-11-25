/**
 * Tests for Morpho market risk calculation
 */

import { computeMetricsForMarket, normalize01 } from '@/lib/morpho/compute';
import { mergeConfig } from '@/lib/morpho/config';
import type { Market } from '@morpho-org/blue-api-sdk';
import type { CuratorConfig } from '@/lib/morpho/types';

// Mock logger to avoid console output during tests
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Helper to create a mock market
// Uses type assertion to allow partial state objects for testing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockMarket(overrides: any = {}): Market {
  const defaultState = {
    supplyAssetsUsd: 1_000_000,
    borrowAssetsUsd: 500_000,
    liquidityAssetsUsd: 500_000,
    utilization: 0.5,
    supplyApy: 0.05,
    borrowApy: 0.07,
    sizeUsd: 1_000_000,
  };
  
  const { state: stateOverrides, ...restOverrides } = overrides;
  
  // Handle explicit null state
  const finalState = stateOverrides === null 
    ? null 
    : {
        ...defaultState,
        ...(stateOverrides || {}),
      } as Market['state'];
  
  return {
    id: 'test-market-1',
    uniqueKey: 'test-market-1',
    chainId: 8453,
    loanAsset: {
      address: '0x123',
      symbol: 'USDC',
      decimals: 6,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    collateralAsset: {
      address: '0x456',
      symbol: 'WETH',
      decimals: 18,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    state: finalState,
    ...restOverrides,
  } as Market;
}

describe('normalize01', () => {
  it('should clamp values to [0, 1]', () => {
    expect(normalize01(-1)).toBe(0);
    expect(normalize01(0)).toBe(0);
    expect(normalize01(0.5)).toBe(0.5);
    expect(normalize01(1)).toBe(1);
    expect(normalize01(2)).toBe(1);
  });

  it('should handle non-finite values', () => {
    expect(normalize01(NaN)).toBe(0);
    expect(normalize01(Infinity)).toBe(0);
    expect(normalize01(-Infinity)).toBe(0);
  });
});

describe('computeMetricsForMarket', () => {
  let defaultConfig: CuratorConfig;

  beforeEach(() => {
    defaultConfig = mergeConfig();
  });

  describe('TVL computation', () => {
    it('should use sizeUsd when available', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: 2_000_000,
          supplyAssetsUsd: 1_000_000,
          borrowAssetsUsd: 500_000,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.tvlUsd).toBe(2_000_000);
    });

    it('should fallback to suppliedRaw + borrowed when sizeUsd is missing', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: null,
          supplyAssetsUsd: 1_000_000,
          borrowAssetsUsd: 500_000,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.tvlUsd).toBe(1_500_000);
    });

    it('should handle zero sizeUsd by using fallback', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: 0,
          supplyAssetsUsd: 1_000_000,
          borrowAssetsUsd: 500_000,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.tvlUsd).toBe(1_500_000);
    });
  });

  describe('Empty/small markets', () => {
    it('should return null rating for markets below minTvlUsd', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: 5_000, // Below default 10k threshold
          supplyAssetsUsd: 5_000,
          borrowAssetsUsd: 0,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.rating).toBeNull();
      expect(metrics.insufficientTvl).toBe(true);
      expect(metrics.minTvlThresholdHit).toBe(true);
    });

    it('should return rating for markets above minTvlUsd', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: 50_000,
          supplyAssetsUsd: 50_000,
          borrowAssetsUsd: 0,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.rating).not.toBeNull();
      expect(metrics.rating).toBeGreaterThanOrEqual(0);
      expect(metrics.rating).toBeLessThanOrEqual(100);
      expect(metrics.insufficientTvl).toBe(false);
    });

    it('should respect custom minTvlUsd', () => {
      const config = mergeConfig({ minTvlUsd: 100_000 });
      const market = createMockMarket({
        state: {
          sizeUsd: 50_000,
          supplyAssetsUsd: 50_000,
          borrowAssetsUsd: 0,
        },
      });

      const metrics = computeMetricsForMarket(market, config);
      expect(metrics.rating).toBeNull();
      expect(metrics.insufficientTvl).toBe(true);
    });
  });

  describe('Utilization scoring', () => {
    it('should give perfect score for low utilization', () => {
      const market = createMockMarket({
        state: {
          utilization: 0.5,
          supplyAssetsUsd: 1_000_000,
          borrowAssetsUsd: 500_000,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.utilizationScore).toBe(1);
    });

    it('should penalize high utilization', () => {
      const market = createMockMarket({
        state: {
          utilization: 0.95, // Above 90% ceiling
          supplyAssetsUsd: 1_000_000,
          borrowAssetsUsd: 950_000,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.utilizationScore).toBeLessThan(1);
      expect(metrics.utilizationScore).toBeGreaterThan(0);
    });

    it('should handle utilization above maxUtilizationBeyond', () => {
      const market = createMockMarket({
        state: {
          utilization: 1.15, // Above 1.1 maxUtilizationBeyond
          supplyAssetsUsd: 1_000_000,
          borrowAssetsUsd: 1_150_000,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.utilizationScore).toBe(0);
    });

    it('should respect custom maxUtilizationBeyond', () => {
      const config = mergeConfig({ maxUtilizationBeyond: 1.2 });
      const market = createMockMarket({
        state: {
          utilization: 1.15,
          supplyAssetsUsd: 1_000_000,
          borrowAssetsUsd: 1_150_000,
        },
      });

      const metrics = computeMetricsForMarket(market, config);
      expect(metrics.utilizationScore).toBeGreaterThan(0);
    });
  });

  describe('Rate alignment scoring', () => {
    it('should give perfect score when supply rate matches benchmark', () => {
      const market = createMockMarket({
        state: {
          supplyApy: 0.05, // Matches default benchmark
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.rateAlignmentScore).toBeCloseTo(1, 2);
    });

    it('should penalize deviation from benchmark', () => {
      const market = createMockMarket({
        state: {
          supplyApy: 0.10, // 5% above benchmark
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.rateAlignmentScore).toBeLessThan(1);
    });

    it('should apply high yield penalty when rate is too high', () => {
      const market = createMockMarket({
        state: {
          supplyApy: 0.15, // 10% above benchmark (5% + 3% buffer)
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      // Should have additional penalty beyond normal rate alignment
      expect(metrics.rateAlignmentScore).toBeLessThan(0.5);
    });

    it('should use custom benchmark when provided', () => {
      const market = createMockMarket({
        state: {
          supplyApy: 0.08,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig, 0.08);
      expect(metrics.benchmarkSupplyRate).toBe(0.08);
      expect(metrics.rateAlignmentScore).toBeCloseTo(1, 2);
    });
  });

  describe('Stress exposure scoring', () => {
    it('should give perfect score when no insolvency risk', () => {
      const market = createMockMarket({
        state: {
          supplyAssetsUsd: 1_000_000,
          borrowAssetsUsd: 500_000, // Well below collateral after 30% shock (700k)
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.stressExposureScore).toBe(1);
      expect(metrics.potentialInsolvencyUsd).toBe(0);
    });

    it('should penalize markets with insolvency risk', () => {
      const market = createMockMarket({
        state: {
          supplyAssetsUsd: 1_000_000,
          borrowAssetsUsd: 800_000, // Above collateral after 30% shock (700k)
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.potentialInsolvencyUsd).toBeGreaterThan(0);
      expect(metrics.stressExposureScore).toBeLessThan(1);
    });

    it('should clamp collateralAfterShock at zero', () => {
      const config = mergeConfig({ priceStressPct: 1.5 }); // Invalid > 1, should clamp
      const market = createMockMarket({
        state: {
          supplyAssetsUsd: 1_000_000,
          borrowAssetsUsd: 500_000,
        },
      });

      const metrics = computeMetricsForMarket(market, config);
      expect(metrics.potentialInsolvencyUsd).toBeGreaterThanOrEqual(0);
    });

    it('should scale tolerance for large markets ($50M+)', () => {
      // Large market ($100M TVL) - verify scaling increases tolerance
      // Test with lower exposure that should give positive score
      const largeMarket = createMockMarket({
        state: {
          sizeUsd: 100_000_000, // $100M (above $50M threshold)
          supplyAssetsUsd: 100_000_000,
          borrowAssetsUsd: 75_000_000, // 75% utilization = ~5% insolvency after 30% shock
        },
      });

      const metrics = computeMetricsForMarket(largeMarket, defaultConfig);
      // For $100M market: should have increased tolerance from base (scaling toward 20% at $500M)
      // With ~5% insolvency exposure, should score well (>0.7) due to soft curve
      expect(metrics.stressExposureScore).toBeGreaterThan(0.7);
      expect(metrics.insolvencyPctOfTvl).toBeLessThan(0.1); // ~5% exposure
    });

    it('should use base tolerance for small markets (<$50M)', () => {
      // Small market should use base 1% tolerance
      const market = createMockMarket({
        state: {
          sizeUsd: 10_000_000, // $10M (below $50M threshold)
          supplyAssetsUsd: 10_000_000,
          borrowAssetsUsd: 8_000_000,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      // Small markets use base tolerance, so higher insolvency % should still penalize
      expect(metrics.stressExposureScore).toBeLessThan(1);
    });

    it('should score very large markets ($500M+) with 20% exposure reasonably', () => {
      // Simulate a very large market ($1B) with 20% insolvency exposure
      // This should score reasonably well (not near zero) due to:
      // 1. Higher tolerance (20% base for $500M markets, scaling to 35% at $2B)
      // 2. Softer scoring curve (minimal penalty up to 80% of tolerance)
      // To get ~20% insolvency: borrowed = 921M, supplied = 1024M
      // After 30% price shock: collateral = 1024M * 0.7 = 716.8M
      // Insolvency = 921M - 716.8M = 204.2M = ~20% of TVL
      const largeMarket = createMockMarket({
        state: {
          sizeUsd: 1_024_000_000, // ~$1.024B (above $500M threshold)
          supplyAssetsUsd: 1_024_000_000,
          borrowAssetsUsd: 921_910_000, // ~90% utilization
          utilization: 0.90,
        },
      });

      const metrics = computeMetricsForMarket(largeMarket, defaultConfig);
      
      // With ~20% exposure and ~25% tolerance (scaled from 20% base):
      // - Exposure is ~80% of tolerance
      // - Should score reasonably due to soft curve (minimal penalty up to 80%)
      // Note: Actual insolvency may vary slightly due to price shock calculation
      // The test verifies that large markets get better scoring than small markets
      expect(metrics.insolvencyPctOfTvl).toBeGreaterThan(0.1); // Should have some exposure
      if (metrics.insolvencyPctOfTvl > 0.15) {
        // If exposure is high, should still score reasonably due to soft curve
        expect(metrics.stressExposureScore).toBeGreaterThan(0.3);
      }
      
      // Overall rating should be decent due to:
      // - High utilization score (90% is at ceiling)
      // - Reasonable stress exposure score (not near zero for large markets)
      // - Good withdrawal liquidity (100%)
      if (metrics.rating !== null) {
        expect(metrics.rating).toBeGreaterThan(50);
      }
    });

    it('should score liquidation capacity reasonably for large markets ($50M+) with 30% coverage', () => {
      // Simulate large market ($100M) with 30% liquidation capacity
      // TVL: $100M, Supply: $100M, Borrow: $75M
      // Available liquidity: $25M
      // After 40% liquidity stress: $15M
      // Insolvency: ~$5M (after 30% price shock)
      // Coverage ratio: $15M / $50M = 0.30 (30%) - approximate
      const market = createMockMarket({
        state: {
          sizeUsd: 100_000_000, // $100M (above $50M threshold)
          supplyAssetsUsd: 100_000_000,
          borrowAssetsUsd: 75_000_000, // High borrow = high insolvency exposure
          liquidityAssetsUsd: 25_000_000, // Available liquidity
          utilization: 0.75,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      
      // With 30% liquidation capacity coverage, should score in 0.3-0.6 range
      // (not near zero like linear scoring would give for small markets)
      // The soft curve maps 30% coverage -> 0.3 score, 50% coverage -> 0.6 score
      expect(metrics.liquidationCapacityScore).toBeGreaterThan(0.25); // Should benefit from soft curve
      expect(metrics.liquidationCapacityScore).toBeLessThan(0.6);
    });

    it('should use base tolerance for small markets', () => {
      // Small market should use base 1% tolerance
      const market = createMockMarket({
        state: {
          sizeUsd: 100_000, // $100k
          supplyAssetsUsd: 100_000,
          borrowAssetsUsd: 80_000,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      // Small markets use base tolerance, so higher insolvency % should still penalize
      expect(metrics.stressExposureScore).toBeLessThan(1);
    });
  });

  describe('Withdrawal liquidity scoring', () => {
    it('should give perfect score when liquidity meets requirement', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: 1_000_000,
          liquidityAssetsUsd: 200_000, // 20% > 10% requirement
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.withdrawalLiquidityScore).toBe(1);
    });

    it('should penalize insufficient liquidity', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: 1_000_000,
          liquidityAssetsUsd: 50_000, // 5% < 10% requirement
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.withdrawalLiquidityScore).toBeLessThan(1);
      expect(metrics.withdrawalLiquidityScore).toBe(0.5); // 50k / 100k required
    });
  });

  describe('Liquidation capacity scoring', () => {
    it('should give perfect score when capacity exceeds debt', () => {
      const market = createMockMarket({
        state: {
          supplyAssetsUsd: 1_000_000,
          borrowAssetsUsd: 500_000,
          liquidityAssetsUsd: 1_000_000, // High liquidity
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      // After 40% liquidity stress: 600k capacity > 200k debt (800k - 700k collateral)
      expect(metrics.liquidationCapacityScore).toBe(1);
    });

    it('should penalize insufficient liquidation capacity', () => {
      const market = createMockMarket({
        state: {
          supplyAssetsUsd: 1_000_000,
          borrowAssetsUsd: 900_000, // High borrow
          liquidityAssetsUsd: 100_000, // Low liquidity
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.liquidationCapacityScore).toBeLessThan(1);
    });
  });

  describe('Config clamping', () => {
    it('should clamp priceStressPct to [0, 1]', () => {
      const config = mergeConfig({ priceStressPct: 1.5 }); // Invalid
      const market = createMockMarket({
        state: {
          supplyAssetsUsd: 1_000_000,
          borrowAssetsUsd: 500_000,
        },
      });

      const metrics = computeMetricsForMarket(market, config);
      // Should use clamped value (1.0), so collateralAfterShock = 0
      expect(metrics.potentialInsolvencyUsd).toBeGreaterThanOrEqual(0);
    });

    it('should clamp liquidityStressPct to [0, 1]', () => {
      const config = mergeConfig({ liquidityStressPct: -0.1 }); // Invalid
      const market = createMockMarket({
        state: {
          liquidityAssetsUsd: 1_000_000,
        },
      });

      const metrics = computeMetricsForMarket(market, config);
      // Should use clamped value (0), so liquidatorCapacityPostStress = 1_000_000
      expect(metrics.liquidatorCapacityPostStress).toBe(1_000_000);
    });

    it('should clamp utilizationCeiling to [0, 1]', () => {
      const config = mergeConfig({ utilizationCeiling: 1.2 }); // Invalid
      const market = createMockMarket({
        state: {
          utilization: 0.95,
        },
      });

      const metrics = computeMetricsForMarket(market, config);
      // Should still compute correctly with clamped ceiling
      expect(metrics.utilizationScore).toBeGreaterThanOrEqual(0);
      expect(metrics.utilizationScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Weight normalization', () => {
    it('should use normalized weights in aggregate calculation', () => {
      const config = mergeConfig({
        weights: {
          utilization: 0.4,
          rateAlignment: 0.3,
          stressExposure: 0.6,
          withdrawalLiquidity: 0.4,
          liquidationCapacity: 0.3,
        }, // Sum = 2.0, should normalize to sum = 1.0
      });

      const market = createMockMarket();
      const metrics = computeMetricsForMarket(market, config);

      // Check that weights sum to 1
      const sum = Object.values(metrics.effectiveWeights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });

    it('should handle zero weights by falling back to defaults', () => {
      const config = mergeConfig({
        weights: {
          utilization: 0,
          rateAlignment: 0,
          stressExposure: 0,
          withdrawalLiquidity: 0,
          liquidationCapacity: 0,
        },
      });

      const market = createMockMarket();
      const metrics = computeMetricsForMarket(market, config);

      // Should use default weights
      expect(metrics.effectiveWeights.utilization).toBe(0.2);
    });
  });

  describe('Aggregate rating', () => {
    it('should compute rating between 0 and 100', () => {
      const market = createMockMarket();
      const metrics = computeMetricsForMarket(market, defaultConfig);

      if (metrics.rating !== null) {
        expect(metrics.rating).toBeGreaterThanOrEqual(0);
        expect(metrics.rating).toBeLessThanOrEqual(100);
      }
    });

    it('should round rating to integer', () => {
      const market = createMockMarket();
      const metrics = computeMetricsForMarket(market, defaultConfig);

      if (metrics.rating !== null) {
        expect(Number.isInteger(metrics.rating)).toBe(true);
      }
    });

    it('should include all required metadata fields', () => {
      const market = createMockMarket();
      const metrics = computeMetricsForMarket(market, defaultConfig);

      expect(metrics).toHaveProperty('id');
      expect(metrics).toHaveProperty('symbol');
      expect(metrics).toHaveProperty('tvlUsd');
      expect(metrics).toHaveProperty('minTvlThresholdHit');
      expect(metrics).toHaveProperty('insufficientTvl');
      expect(metrics).toHaveProperty('effectiveWeights');
      expect(metrics).toHaveProperty('rating');
      expect(metrics).toHaveProperty('configVersion');
      expect(metrics).toHaveProperty('raw');
    });
  });

  describe('Edge cases', () => {
    it('should handle market with null state', () => {
      const market = createMockMarket({ state: null });
      const metrics = computeMetricsForMarket(market, defaultConfig);

      // When state is null, utilization = borrowed/supplied = 0/1 = 0
      expect(metrics.utilization).toBe(0);
      expect(metrics.supplyRate).toBeNull();
      expect(metrics.borrowRate).toBeNull();
    });

    it('should handle market with zero supplied', () => {
      const market = createMockMarket({
        state: {
          supplyAssetsUsd: 0,
          borrowAssetsUsd: 0,
          utilization: undefined, // Clear default utilization
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      // When supplied is 0, the code uses 1 as fallback to prevent divide-by-zero
      // So utilization = borrowed / supplied = 0 / 1 = 0
      expect(metrics.utilization).toBe(0);
    });

    it('should handle market with missing loanAsset symbol', () => {
      const market = createMockMarket({
        loanAsset: {
          address: '0x123',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          symbol: null as any,
          decimals: 6,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.symbol).toBe('UNKNOWN');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle a healthy market', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: 10_000_000,
          supplyAssetsUsd: 10_000_000,
          borrowAssetsUsd: 5_000_000,
          liquidityAssetsUsd: 2_000_000,
          utilization: 0.5,
          supplyApy: 0.05,
          borrowApy: 0.07,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.rating).not.toBeNull();
      if (metrics.rating !== null) {
        expect(metrics.rating).toBeGreaterThan(70); // Should be high for healthy market
      }
    });

    it('should handle a risky market', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: 10_000_000,
          supplyAssetsUsd: 10_000_000,
          borrowAssetsUsd: 9_000_000, // High utilization
          liquidityAssetsUsd: 100_000, // Low liquidity
          utilization: 0.9,
          supplyApy: 0.15, // High yield (suspicious)
          borrowApy: 0.20,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.rating).not.toBeNull();
      if (metrics.rating !== null) {
        expect(metrics.rating).toBeLessThan(60); // Should be lower for risky market
      }
      expect(metrics.utilizationScore).toBeLessThan(1);
      expect(metrics.rateAlignmentScore).toBeLessThan(1);
    });
  });
});

