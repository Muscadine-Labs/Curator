import { NextRequest, NextResponse } from 'next/server';
import { getMorphoMarketRatings } from '@/lib/morpho/service';
import type { CuratorConfigOverrides } from '@/lib/morpho/config';
import { GRAPHQL_FIRST_LIMIT } from '@/lib/constants';
import { handleApiError, AppError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';

export const revalidate = 300;

function parsePositiveNumber(value: string | null, field: string, max?: number): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError(`Invalid ${field} parameter`, 400, `INVALID_${field.toUpperCase()}`);
  }
  if (max !== undefined) {
    return Math.min(parsed, max);
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitMiddleware = createRateLimitMiddleware(
    RATE_LIMIT_REQUESTS_PER_MINUTE,
    MINUTE_MS
  );
  const rateLimitResult = rateLimitMiddleware(request);
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { 
        status: 429,
        headers: rateLimitResult.headers,
      }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parsePositiveNumber(searchParams.get('limit'), 'limit', GRAPHQL_FIRST_LIMIT);
    const marketId = searchParams.get('marketId') ?? searchParams.get('id') ?? undefined;

    const overrides = parseConfigOverrides(searchParams);

    const markets = await getMorphoMarketRatings({
      limit,
      marketId,
      configOverride: overrides,
    });

    if (marketId && markets.length === 0) {
      throw new AppError('Market not found', 404, 'MARKET_NOT_FOUND');
    }

    const responseHeaders = new Headers(rateLimitResult.headers);
    responseHeaders.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      markets,
    }, { headers: responseHeaders });
  } catch (error) {
    const { error: apiError, statusCode } = handleApiError(error, 'Failed to fetch market ratings');
    return NextResponse.json(apiError, { status: statusCode });
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

