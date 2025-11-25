import { NextResponse } from 'next/server';
import { sanitizeAddress, sanitizeString, sanitizeNumber, sanitizeAction, sanitizeNotes } from '@/lib/utils/sanitize';
import { handleApiError, AppError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';

type AllocationIntent = {
  id: string;
  vaultAddress: string;
  marketKey: string;
  action: 'allocate' | 'deallocate';
  amountUsd?: number | null;
  sharePct?: number | null;
  walletAddress?: string | null;
  notes?: string | null;
  createdAt: string;
};

// In-memory storage - NOTE: This is temporary and data will be lost on server restart
// For production, replace with a database (PostgreSQL, Supabase, etc.)
const intentsStore: AllocationIntent[] = [];
const MAX_STORE_SIZE = 1000; // Limit store size to prevent memory issues

type AllocationIntentPayload = {
  vaultAddress: string;
  marketKey: string;
  action: 'allocate' | 'deallocate';
  amountUsd?: number;
  sharePct?: number;
  walletAddress?: string;
  notes?: string;
};

function validateAndSanitizePayload(value: unknown): AllocationIntentPayload {
  if (!value || typeof value !== 'object') {
    throw new AppError('Invalid payload', 400, 'INVALID_PAYLOAD');
  }
  
  const payload = value as Record<string, unknown>;
  
  // Validate and sanitize required fields
  if (!payload.vaultAddress || typeof payload.vaultAddress !== 'string') {
    throw new AppError('vaultAddress is required', 400, 'MISSING_VAULT_ADDRESS');
  }
  
  if (!payload.marketKey || typeof payload.marketKey !== 'string') {
    throw new AppError('marketKey is required', 400, 'MISSING_MARKET_KEY');
  }
  
  if (payload.action !== 'allocate' && payload.action !== 'deallocate') {
    throw new AppError('action must be allocate or deallocate', 400, 'INVALID_ACTION');
  }
  
  // Sanitize and validate all inputs
  return {
    vaultAddress: sanitizeAddress(payload.vaultAddress) || '',
    marketKey: sanitizeString(payload.marketKey, 200),
    action: sanitizeAction(payload.action),
    amountUsd: sanitizeNumber(payload.amountUsd, 0) ?? undefined,
    sharePct: sanitizeNumber(payload.sharePct, 0, 100) ?? undefined,
    walletAddress: payload.walletAddress ? sanitizeAddress(String(payload.walletAddress)) ?? undefined : undefined,
    notes: payload.notes ? sanitizeNotes(String(payload.notes)) : undefined,
  };
}

export async function GET(request: Request) {
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

  const responseHeaders = new Headers(rateLimitResult.headers);
  responseHeaders.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');

  return NextResponse.json(
    { 
      intents: intentsStore.slice(0, 50),
      note: 'This is in-memory storage. Data will be lost on server restart. For production, use a database.'
    },
    { headers: responseHeaders }
  );
}

export async function POST(request: Request) {
  // Rate limiting (stricter for POST)
  const rateLimitMiddleware = createRateLimitMiddleware(
    RATE_LIMIT_REQUESTS_PER_MINUTE / 2, // Half the rate for POST
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
    const payload = await request.json();
    const sanitizedPayload = validateAndSanitizePayload(payload);

    const intent: AllocationIntent = {
      id: crypto.randomUUID(),
      vaultAddress: sanitizedPayload.vaultAddress,
      marketKey: sanitizedPayload.marketKey,
      action: sanitizedPayload.action,
      amountUsd: sanitizedPayload.amountUsd,
      sharePct: sanitizedPayload.sharePct,
      walletAddress: sanitizedPayload.walletAddress,
      notes: sanitizedPayload.notes ?? null,
      createdAt: new Date().toISOString(),
    };

    // Prevent memory issues by limiting store size
    intentsStore.unshift(intent);
    if (intentsStore.length > MAX_STORE_SIZE) {
      intentsStore.splice(MAX_STORE_SIZE);
    }

    return NextResponse.json({ intent }, { status: 201 });
  } catch (error) {
    const { error: apiError, statusCode } = handleApiError(error, 'Failed to create allocation intent');
    return NextResponse.json(apiError, { status: statusCode });
  }
}


