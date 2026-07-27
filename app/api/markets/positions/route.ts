import { NextRequest, NextResponse } from 'next/server';
import { fetchUserMarketPositions } from '@/lib/morpho/fetch-user-market-positions';
import {
  defaultCuratorMarketChainId,
} from '@/lib/morpho/curator-markets';
import { CURATOR_MARKET_NETWORKS } from '@/lib/constants';
import { handleApiError, AppError } from '@/lib/utils/error-handler';
import {
  createRateLimitMiddleware,
  RATE_LIMIT_REQUESTS_PER_MINUTE,
  MINUTE_MS,
} from '@/lib/utils/rate-limit';
import { mergeApiCacheHeaders } from '@/lib/api/response-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseChainId(raw: string | null): number {
  const chainId = raw != null ? Number(raw) : defaultCuratorMarketChainId();
  const allowed = CURATOR_MARKET_NETWORKS.some((n) => n.chainId === chainId);
  if (!Number.isFinite(chainId) || !allowed) {
    throw new AppError('Invalid chainId', 400, 'INVALID_CHAIN_ID');
  }
  return chainId;
}

export async function GET(request: NextRequest) {
  const rateLimitMiddleware = createRateLimitMiddleware(
    RATE_LIMIT_REQUESTS_PER_MINUTE,
    MINUTE_MS
  );
  const rateLimitResult = rateLimitMiddleware(request);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    if (!address) {
      throw new AppError('Missing address', 400, 'MISSING_ADDRESS');
    }
    const chainId = parseChainId(searchParams.get('chainId'));
    const positions = await fetchUserMarketPositions(address, chainId);

    // Serialize bigints for JSON
    const payload = positions.map((p) => ({
      ...p,
      supplyAssets: p.supplyAssets.toString(),
      borrowAssets: p.borrowAssets.toString(),
      collateral: p.collateral.toString(),
    }));

    return NextResponse.json(
      { chainId, address, positions: payload },
      { headers: mergeApiCacheHeaders(rateLimitResult.headers, 15) }
    );
  } catch (error) {
    const { error: apiError, statusCode } = handleApiError(
      error,
      'Failed to fetch market positions'
    );
    return NextResponse.json(apiError, { status: statusCode });
  }
}
