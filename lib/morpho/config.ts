import type { CuratorConfig, CuratorWeights } from './types';

export type CuratorConfigOverrides = Partial<Omit<CuratorConfig, 'weights'>> & {
  weights?: Partial<CuratorWeights>;
};

const DEFAULT_WEIGHTS: CuratorWeights = {
  utilization: 0.2,
  rateAlignment: 0.15,
  stressExposure: 0.3,
  withdrawalLiquidity: 0.2,
  liquidationCapacity: 0.15,
};

export const DEFAULT_CURATOR_CONFIG: CuratorConfig = {
  morphoApiUrl: 'https://api.morpho.org/graphql',
  utilizationCeiling: 0.9,
  utilizationBufferHours: 48,
  rateAlignmentEps: 0.02,
  fallbackBenchmarkRate: 0.05,
  priceStressPct: 0.3,
  liquidityStressPct: 0.4,
  withdrawalLiquidityMinPct: 0.1,
  insolvencyTolerancePctTvl: 0.0005,
  weights: DEFAULT_WEIGHTS,
};

function parseNumberEnv(key: string): number | undefined {
  const raw = process.env[key];
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function loadConfigFromEnv(): CuratorConfigOverrides {
  const weights: Partial<CuratorWeights> = {};
  const weightKeys: Array<keyof CuratorWeights> = [
    'utilization',
    'rateAlignment',
    'stressExposure',
    'withdrawalLiquidity',
    'liquidationCapacity',
  ];

  weightKeys.forEach((key) => {
    const envKey = `CURATOR_WEIGHT_${key.toUpperCase()}`;
    const value = parseNumberEnv(envKey);
    if (value !== undefined) {
      weights[key] = value;
    }
  });

  const config: CuratorConfigOverrides = {
    morphoApiUrl: process.env.MORPHO_API_URL,
    utilizationCeiling: parseNumberEnv('CURATOR_UTILIZATION_CEILING'),
    utilizationBufferHours: parseNumberEnv('CURATOR_UTILIZATION_BUFFER_HOURS'),
    rateAlignmentEps: parseNumberEnv('CURATOR_RATE_ALIGNMENT_EPS'),
    fallbackBenchmarkRate: parseNumberEnv('CURATOR_FALLBACK_BENCHMARK_RATE'),
    priceStressPct: parseNumberEnv('CURATOR_PRICE_STRESS_PCT'),
    liquidityStressPct: parseNumberEnv('CURATOR_LIQUIDITY_STRESS_PCT'),
    withdrawalLiquidityMinPct: parseNumberEnv('CURATOR_WITHDRAWAL_LIQUIDITY_MIN_PCT'),
    insolvencyTolerancePctTvl: parseNumberEnv('CURATOR_INSOLVENCY_TOLERANCE_PCT_TVL'),
    weights: Object.keys(weights).length ? weights : undefined,
  };

  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined)
  ) as CuratorConfigOverrides;
}

export function mergeConfig(overrides?: CuratorConfigOverrides): CuratorConfig {
  const envOverrides = loadConfigFromEnv();
  const source = { ...envOverrides, ...overrides };
  const mergedWeights: CuratorWeights = {
    ...DEFAULT_CURATOR_CONFIG.weights,
    ...envOverrides.weights,
    ...overrides?.weights,
  };

  return {
    ...DEFAULT_CURATOR_CONFIG,
    ...source,
    weights: mergedWeights,
  };
}

