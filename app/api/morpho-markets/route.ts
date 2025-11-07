import { NextRequest, NextResponse } from 'next/server';
import { getMorphoMarketRatings } from '@/lib/morpho/service';
import type { CuratorConfigOverrides } from '@/lib/morpho/config';

export const revalidate = 300;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const marketId = searchParams.get('marketId') ?? searchParams.get('id') ?? undefined;

    let limit: number | undefined;
    if (limitParam !== null) {
      const parsed = Number(limitParam);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return NextResponse.json(
          { error: 'Invalid limit parameter' },
          { status: 400 }
        );
      }
      limit = Math.min(parsed, 1000);
    }

    const overrides = parseConfigOverrides(searchParams);

    const markets = await getMorphoMarketRatings({
      limit,
      marketId,
      configOverride: overrides,
    });

    if (marketId && markets.length === 0) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      markets,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 }
    );
  }
}

function parseConfigOverrides(
  params: URLSearchParams
): CuratorConfigOverrides | undefined {
  const overrides: CuratorConfigOverrides = {};
  const weights: NonNullable<CuratorConfigOverrides['weights']> = {};

  const numericKeys: Array<keyof CuratorConfigOverrides> = [
    'utilizationCeiling',
    'utilizationBufferHours',
    'rateAlignmentEps',
    'fallbackBenchmarkRate',
    'priceStressPct',
    'liquidityStressPct',
    'withdrawalLiquidityMinPct',
    'insolvencyTolerancePctTvl',
  ];

  numericKeys.forEach((key) => {
    const value = params.get(key);
    if (value !== null) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        overrides[key] = parsed as never;
      }
    }
  });

  ['utilization', 'rateAlignment', 'stressExposure', 'withdrawalLiquidity', 'liquidationCapacity'].forEach(
    (key) => {
      const value = params.get(`weight.${key}`);
      if (value !== null) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          weights[key as keyof typeof weights] = parsed;
        }
      }
    }
  );

  if (Object.keys(weights).length) {
    overrides.weights = weights;
  }

  return Object.keys(overrides).length ? overrides : undefined;
}

