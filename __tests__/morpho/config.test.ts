/**
 * Tests for Morpho curator configuration
 */

import { mergeConfig, DEFAULT_CURATOR_CONFIG, loadConfigFromEnv } from '@/lib/morpho/config';

describe('mergeConfig', () => {
  it('should return default config when no overrides', () => {
    const config = mergeConfig();
    expect(config.utilizationCeiling).toBe(0.9);
    expect(config.priceStressPct).toBe(0.3);
    expect(config.insolvencyTolerancePctTvl).toBe(0.01);
  });

  it('should apply config overrides', () => {
    const config = mergeConfig({
      utilizationCeiling: 0.85,
      priceStressPct: 0.25,
    });

    expect(config.utilizationCeiling).toBe(0.85);
    expect(config.priceStressPct).toBe(0.25);
    expect(config.insolvencyTolerancePctTvl).toBe(0.01); // Unchanged
  });

  it('should normalize weights to sum to 1', () => {
    const config = mergeConfig({
      weights: {
        utilization: 0.4,
        rateAlignment: 0.3,
        stressExposure: 0.6,
        withdrawalLiquidity: 0.4,
        liquidationCapacity: 0.3,
      }, // Sum = 2.0
    });

    const sum = Object.values(config.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('should handle zero weights by using defaults', () => {
    const config = mergeConfig({
      weights: {
        utilization: 0,
        rateAlignment: 0,
        stressExposure: 0,
        withdrawalLiquidity: 0,
        liquidationCapacity: 0,
      },
    });

    // Should fall back to default weights
    expect(config.weights.utilization).toBe(0.2);
    expect(config.weights.stressExposure).toBe(0.3);
  });

  it('should handle partial weight overrides', () => {
    const config = mergeConfig({
      weights: {
        utilization: 0.5, // Only override one weight
      },
    });

    const sum = Object.values(config.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(config.weights.utilization).toBeGreaterThan(0.2); // Should be normalized from 0.5
  });

  it('should preserve all default config values', () => {
    const config = mergeConfig();
    
    expect(config).toHaveProperty('morphoApiUrl');
    expect(config).toHaveProperty('utilizationCeiling');
    expect(config).toHaveProperty('utilizationBufferHours');
    expect(config).toHaveProperty('maxUtilizationBeyond');
    expect(config).toHaveProperty('rateAlignmentEps');
    expect(config).toHaveProperty('rateAlignmentHighYieldBuffer');
    expect(config).toHaveProperty('rateAlignmentHighYieldEps');
    expect(config).toHaveProperty('fallbackBenchmarkRate');
    expect(config).toHaveProperty('priceStressPct');
    expect(config).toHaveProperty('liquidityStressPct');
    expect(config).toHaveProperty('withdrawalLiquidityMinPct');
    expect(config).toHaveProperty('insolvencyTolerancePctTvl');
    expect(config).toHaveProperty('minTvlUsd');
    expect(config).toHaveProperty('weights');
    expect(config).toHaveProperty('configVersion');
  });
});

describe('loadConfigFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clear specific env vars
    delete process.env.CURATOR_PRICE_STRESS_PCT;
    delete process.env.CURATOR_LIQUIDITY_STRESS_PCT;
    delete process.env.CURATOR_WEIGHT_UTILIZATION;
    delete process.env.CURATOR_WEIGHT_STRESS_EXPOSURE;
    delete process.env.CURATOR_UTILIZATION_CEILING;
    delete process.env.CURATOR_UTILIZATION_BUFFER_HOURS;
    delete process.env.CURATOR_MAX_UTILIZATION_BEYOND;
    delete process.env.CURATOR_RATE_ALIGNMENT_EPS;
    delete process.env.CURATOR_RATE_ALIGNMENT_HIGH_YIELD_BUFFER;
    delete process.env.CURATOR_RATE_ALIGNMENT_HIGH_YIELD_EPS;
    delete process.env.CURATOR_FALLBACK_BENCHMARK_RATE;
    delete process.env.CURATOR_WITHDRAWAL_LIQUIDITY_MIN_PCT;
    delete process.env.CURATOR_INSOLVENCY_TOLERANCE_PCT_TVL;
    delete process.env.CURATOR_MIN_TVL_USD;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return empty config when no env vars set', () => {
    const config = loadConfigFromEnv();
    // May have MORPHO_API_URL or other env vars, so just check specific ones are undefined
    expect(config.priceStressPct).toBeUndefined();
    expect(config.weights).toBeUndefined();
  });

  it('should parse percentage env vars', () => {
    process.env.CURATOR_PRICE_STRESS_PCT = '0.25';
    process.env.CURATOR_LIQUIDITY_STRESS_PCT = '0.35';
    
    const config = loadConfigFromEnv();
    expect(config.priceStressPct).toBe(0.25);
    expect(config.liquidityStressPct).toBe(0.35);
  });

  it('should parse weight env vars', () => {
    // Note: env var names are CURATOR_WEIGHT_<KEY_IN_UPPERCASE>
    // For 'stressExposure', it becomes 'STRESSEXPOSURE' (no underscores)
    process.env.CURATOR_WEIGHT_UTILIZATION = '0.3';
    process.env.CURATOR_WEIGHT_STRESSEXPOSURE = '0.4'; // Note: no underscore
    
    const config = loadConfigFromEnv();
    expect(config.weights).toBeDefined();
    if (config.weights) {
      // Only the weights that were set should be present
      expect(config.weights.utilization).toBe(0.3);
      expect(config.weights.stressExposure).toBe(0.4);
    }
    
    // Clean up
    delete process.env.CURATOR_WEIGHT_UTILIZATION;
    delete process.env.CURATOR_WEIGHT_STRESSEXPOSURE;
  });

  it('should warn when percentage looks like percent instead of decimal', () => {
    // Mock logger before importing config
    jest.mock('@/lib/utils/logger', () => ({
      logger: {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      },
    }));
    
    // Re-import to get mocked logger
    jest.resetModules();
    const { loadConfigFromEnv: loadConfigFromEnvMocked } = require('@/lib/morpho/config');
    const { logger } = require('@/lib/utils/logger');
    
    process.env.CURATOR_PRICE_STRESS_PCT = '30'; // Looks like 30% instead of 0.3
    
    loadConfigFromEnvMocked();
    
    expect(logger.warn).toHaveBeenCalled();
    const callArgs = (logger.warn as jest.Mock).mock.calls[0];
    expect(callArgs[0]).toContain('CURATOR_PRICE_STRESS_PCT looks like a percent');
    
    // Restore original module
    jest.resetModules();
  });

  it('should handle invalid number env vars', () => {
    process.env.CURATOR_UTILIZATION_CEILING = 'invalid';
    process.env.CURATOR_PRICE_STRESS_PCT = 'not-a-number';
    
    const config = loadConfigFromEnv();
    expect(config.utilizationCeiling).toBeUndefined();
    expect(config.priceStressPct).toBeUndefined();
  });

  it('should parse all config fields from env', () => {
    process.env.CURATOR_UTILIZATION_CEILING = '0.85';
    process.env.CURATOR_UTILIZATION_BUFFER_HOURS = '24';
    process.env.CURATOR_MAX_UTILIZATION_BEYOND = '1.15';
    process.env.CURATOR_RATE_ALIGNMENT_EPS = '0.03';
    process.env.CURATOR_RATE_ALIGNMENT_HIGH_YIELD_BUFFER = '0.04';
    process.env.CURATOR_RATE_ALIGNMENT_HIGH_YIELD_EPS = '0.02';
    process.env.CURATOR_FALLBACK_BENCHMARK_RATE = '0.06';
    process.env.CURATOR_PRICE_STRESS_PCT = '0.25';
    process.env.CURATOR_LIQUIDITY_STRESS_PCT = '0.35';
    process.env.CURATOR_WITHDRAWAL_LIQUIDITY_MIN_PCT = '0.15';
    process.env.CURATOR_INSOLVENCY_TOLERANCE_PCT_TVL = '0.015';
    process.env.CURATOR_MIN_TVL_USD = '20000';
    
    const config = loadConfigFromEnv();
    expect(config.utilizationCeiling).toBe(0.85);
    expect(config.utilizationBufferHours).toBe(24);
    expect(config.maxUtilizationBeyond).toBe(1.15);
    expect(config.rateAlignmentEps).toBe(0.03);
    expect(config.rateAlignmentHighYieldBuffer).toBe(0.04);
    expect(config.rateAlignmentHighYieldEps).toBe(0.02);
    expect(config.fallbackBenchmarkRate).toBe(0.06);
    expect(config.priceStressPct).toBe(0.25);
    expect(config.liquidityStressPct).toBe(0.35);
    expect(config.withdrawalLiquidityMinPct).toBe(0.15);
    expect(config.insolvencyTolerancePctTvl).toBe(0.015);
    expect(config.minTvlUsd).toBe(20000);
  });
});

describe('DEFAULT_CURATOR_CONFIG', () => {
  it('should have all required fields', () => {
    expect(DEFAULT_CURATOR_CONFIG).toHaveProperty('morphoApiUrl');
    expect(DEFAULT_CURATOR_CONFIG).toHaveProperty('utilizationCeiling');
    expect(DEFAULT_CURATOR_CONFIG).toHaveProperty('priceStressPct');
    expect(DEFAULT_CURATOR_CONFIG).toHaveProperty('weights');
    expect(DEFAULT_CURATOR_CONFIG).toHaveProperty('configVersion');
  });

  it('should have weights that sum to 1', () => {
    const sum = Object.values(DEFAULT_CURATOR_CONFIG.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('should have percentage fields in [0, 1] range', () => {
    expect(DEFAULT_CURATOR_CONFIG.utilizationCeiling).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CURATOR_CONFIG.utilizationCeiling).toBeLessThanOrEqual(1);
    expect(DEFAULT_CURATOR_CONFIG.priceStressPct).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CURATOR_CONFIG.priceStressPct).toBeLessThanOrEqual(1);
    expect(DEFAULT_CURATOR_CONFIG.liquidityStressPct).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CURATOR_CONFIG.liquidityStressPct).toBeLessThanOrEqual(1);
    expect(DEFAULT_CURATOR_CONFIG.withdrawalLiquidityMinPct).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CURATOR_CONFIG.withdrawalLiquidityMinPct).toBeLessThanOrEqual(1);
    expect(DEFAULT_CURATOR_CONFIG.insolvencyTolerancePctTvl).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CURATOR_CONFIG.insolvencyTolerancePctTvl).toBeLessThanOrEqual(1);
  });

  it('should have reasonable default values', () => {
    expect(DEFAULT_CURATOR_CONFIG.insolvencyTolerancePctTvl).toBe(0.01); // Updated from 0.0005
    expect(DEFAULT_CURATOR_CONFIG.minTvlUsd).toBe(10_000);
    expect(DEFAULT_CURATOR_CONFIG.maxUtilizationBeyond).toBe(1.1);
  });
});

