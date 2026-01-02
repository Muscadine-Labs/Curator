import { NextResponse } from 'next/server';
import { MORPHO_GRAPHQL_ENDPOINT } from '@/lib/constants';
import { logger } from '@/lib/utils/logger';

// Vercel runtime configuration
export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * Health check endpoint to test external API connectivity
 * Useful for debugging Vercel deployment issues
 */
export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; message: string; duration?: number }> = {};

  // Test Morpho GraphQL endpoint
  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(MORPHO_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ __typename }',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (response.ok) {
      checks.morpho = {
        status: 'ok',
        message: `Connected in ${duration}ms`,
        duration,
      };
    } else {
      checks.morpho = {
        status: 'error',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration,
      };
    }
  } catch (error) {
    checks.morpho = {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  // Test DefiLlama endpoint
  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://api.llama.fi/protocol/muscadine', {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (response.ok) {
      checks.defillama = {
        status: 'ok',
        message: `Connected in ${duration}ms`,
        duration,
      };
    } else {
      checks.defillama = {
        status: 'error',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration,
      };
    }
  } catch (error) {
    checks.defillama = {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const allOk = Object.values(checks).every(check => check.status === 'ok');
  const statusCode = allOk ? 200 : 503;

  logger.info('Health check completed', {
    allOk,
    checks: Object.keys(checks),
  });

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
      checks,
    },
    { status: statusCode }
  );
}

