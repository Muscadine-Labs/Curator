/**
 * Tests to investigate why some markets have null ratings
 */

import { computeMetricsForMarket } from '@/lib/morpho/compute';
import { mergeConfig } from '@/lib/morpho/config';
import type { Market } from '@morpho-org/blue-api-sdk';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Helper to create a mock market
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

describe('Null Rating Investigation', () => {
  const defaultConfig = mergeConfig();

  it('should return null rating when TVL is below minTvlUsd threshold', () => {
    const market = createMockMarket({
      state: {
        sizeUsd: 5_000, // Below $10k default threshold
        supplyAssetsUsd: 5_000,
        borrowAssetsUsd: 0,
      },
    });

    const metrics = computeMetricsForMarket(market, defaultConfig);
    expect(metrics.rating).toBeNull();
    expect(metrics.insufficientTvl).toBe(true);
    expect(metrics.minTvlThresholdHit).toBe(true);
    expect(metrics.tvlUsd).toBe(5_000);
  });

  it('should return rating when TVL is exactly at threshold', () => {
    const market = createMockMarket({
      state: {
        sizeUsd: 10_000, // Exactly at $10k threshold (inclusive)
        supplyAssetsUsd: 10_000,
        borrowAssetsUsd: 0,
      },
    });

    const metrics = computeMetricsForMarket(market, defaultConfig);
    // Threshold is exclusive (<), so exactly 10k is valid
    expect(metrics.rating).not.toBeNull();
    expect(metrics.insufficientTvl).toBe(false);
  });

  it('should return rating when TVL is just above threshold', () => {
    const market = createMockMarket({
      state: {
        sizeUsd: 10_001, // Just above $10k threshold
        supplyAssetsUsd: 10_001,
        borrowAssetsUsd: 0,
      },
    });

    const metrics = computeMetricsForMarket(market, defaultConfig);
    expect(metrics.rating).not.toBeNull();
    expect(metrics.insufficientTvl).toBe(false);
    if (metrics.rating !== null) {
      expect(metrics.rating).toBeGreaterThanOrEqual(0);
      expect(metrics.rating).toBeLessThanOrEqual(100);
    }
  });

  it('should handle market with null sizeUsd and low supplied+borrowed', () => {
    const market = createMockMarket({
      state: {
        sizeUsd: null,
        supplyAssetsUsd: 5_000,
        borrowAssetsUsd: 2_000, // Total = 7k, below threshold
      },
    });

    const metrics = computeMetricsForMarket(market, defaultConfig);
    expect(metrics.tvlUsd).toBe(7_000); // suppliedRaw + borrowed
    expect(metrics.rating).toBeNull();
    expect(metrics.insufficientTvl).toBe(true);
  });

  it('should handle market with zero sizeUsd and low supplied+borrowed', () => {
    const market = createMockMarket({
      state: {
        sizeUsd: 0, // Zero, so falls back to supplied + borrowed
        supplyAssetsUsd: 8_000,
        borrowAssetsUsd: 1_000, // Total = 9k, below threshold
      },
    });

    const metrics = computeMetricsForMarket(market, defaultConfig);
    expect(metrics.tvlUsd).toBe(9_000);
    expect(metrics.rating).toBeNull();
    expect(metrics.insufficientTvl).toBe(true);
  });

  it('should handle market with missing state data', () => {
    const market = createMockMarket({
      state: null,
    });

    const metrics = computeMetricsForMarket(market, defaultConfig);
    // When state is null, TVL = 0 + 0 = 0, which is below threshold
    expect(metrics.tvlUsd).toBe(0);
    expect(metrics.rating).toBeNull();
    expect(metrics.insufficientTvl).toBe(true);
  });

  it('should respect custom minTvlUsd threshold', () => {
    const config = mergeConfig({ minTvlUsd: 100_000 });
    const market = createMockMarket({
      state: {
        sizeUsd: 50_000, // Above default 10k but below custom 100k
        supplyAssetsUsd: 50_000,
        borrowAssetsUsd: 0,
      },
    });

    const metrics = computeMetricsForMarket(market, config);
    expect(metrics.rating).toBeNull();
    expect(metrics.insufficientTvl).toBe(true);
  });

  it('should return rating for market with valid TVL but all other scores computed', () => {
    // Even if rating is null, all sub-scores should still be computed
    const market = createMockMarket({
      state: {
        sizeUsd: 5_000, // Below threshold
        supplyAssetsUsd: 5_000,
        borrowAssetsUsd: 2_000,
        utilization: 0.4,
        supplyApy: 0.05,
      },
    });

    const metrics = computeMetricsForMarket(market, defaultConfig);
    expect(metrics.rating).toBeNull();
    // But sub-scores should still be computed
    expect(metrics.utilizationScore).toBeGreaterThanOrEqual(0);
    expect(metrics.rateAlignmentScore).toBeGreaterThanOrEqual(0);
    expect(metrics.stressExposureScore).toBeGreaterThanOrEqual(0);
    expect(metrics.withdrawalLiquidityScore).toBeGreaterThanOrEqual(0);
    expect(metrics.liquidationCapacityScore).toBeGreaterThanOrEqual(0);
  });

  describe('Edge cases that might cause null ratings', () => {
    it('should handle market with very small TVL from rounding', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: 9_999.99, // Just below threshold due to rounding
          supplyAssetsUsd: 9_999.99,
          borrowAssetsUsd: 0,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.rating).toBeNull();
      expect(metrics.tvlUsd).toBeLessThan(10_000);
    });

    it('should handle market with all zero values', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: 0,
          supplyAssetsUsd: 0,
          borrowAssetsUsd: 0,
          liquidityAssetsUsd: 0,
          utilization: 0,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.tvlUsd).toBe(0);
      expect(metrics.rating).toBeNull();
      expect(metrics.insufficientTvl).toBe(true);
    });

    it('should handle market with null state values', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: null,
          supplyAssetsUsd: null,
          borrowAssetsUsd: null,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      // Should use Math.max(0, null ?? 0) = 0 for both, so TVL = 0
      expect(metrics.tvlUsd).toBe(0);
      expect(metrics.rating).toBeNull();
    });

    it('should handle market with undefined state values', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: undefined,
          supplyAssetsUsd: undefined,
          borrowAssetsUsd: undefined,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.tvlUsd).toBe(0);
      expect(metrics.rating).toBeNull();
    });

    it('should provide diagnostic info for null rating markets', () => {
      // Simulate a market that might exist but has very low TVL
      const market = createMockMarket({
        id: '0x13c42741a359ac4a8aa8287d2be109dcf28344484f91185f9a79bd5a805a55ae',
        state: {
          sizeUsd: 5_000, // Below threshold
          supplyAssetsUsd: 5_000,
          borrowAssetsUsd: 0,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.rating).toBeNull();
      expect(metrics.insufficientTvl).toBe(true);
      expect(metrics.tvlUsd).toBe(5_000);
      expect(metrics.minTvlThresholdHit).toBe(true);
      // All sub-scores should still be computed for debugging
      expect(typeof metrics.utilizationScore).toBe('number');
      expect(typeof metrics.stressExposureScore).toBe('number');
    });

    it('should handle market with very small amounts that might round to zero', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: 0.01, // Very small amount
          supplyAssetsUsd: 0.01,
          borrowAssetsUsd: 0,
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.tvlUsd).toBe(0.01);
      expect(metrics.rating).toBeNull();
    });

    it('should handle market where sizeUsd is missing but supplied+borrowed is above threshold', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: null,
          supplyAssetsUsd: 50_000,
          borrowAssetsUsd: 50_000, // Total = 100k, above threshold
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      expect(metrics.tvlUsd).toBe(100_000);
      expect(metrics.rating).not.toBeNull();
      expect(metrics.insufficientTvl).toBe(false);
    });

    it('should handle market with negative values (should be clamped)', () => {
      const market = createMockMarket({
        state: {
          sizeUsd: -1000, // Negative, should fall back
          supplyAssetsUsd: 50_000,
          borrowAssetsUsd: 20_000, // Total = 70k, above threshold
        },
      });

      const metrics = computeMetricsForMarket(market, defaultConfig);
      // Should use fallback (supplied + borrowed)
      expect(metrics.tvlUsd).toBe(70_000);
      expect(metrics.rating).not.toBeNull();
    });
  });
});

