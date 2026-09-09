/**
 * Simple in-memory rate limiting utility
 * For production, consider using @upstash/ratelimit or similar service
 */

import { RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/constants';

export { RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS };

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

/**
 * Simple rate limiter
 * @param identifier - Unique identifier for the rate limit (e.g., IP address, user ID)
 * @param maxRequests - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if request is allowed, false if rate limited
 */
function rateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const key = identifier;

  // Clean up expired entries periodically
  // Use a more aggressive cleanup strategy: clean up every 100th request
  // This ensures memory doesn't grow unbounded while keeping performance good
  const cleanupThreshold = 100;
  const entryCount = Object.keys(store).length;
  if (entryCount > 0 && (entryCount % cleanupThreshold === 0 || Math.random() < 0.02)) {
    // Clean up expired entries
    Object.keys(store).forEach((k) => {
      if (store[k].resetTime < now) {
        delete store[k];
      }
    });
  }

  const entry = store[key];

  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired entry
    store[key] = {
      count: 1,
      resetTime: now + windowMs,
    };
    return true;
  }

  if (entry.count >= maxRequests) {
    return false; // Rate limited
  }

  entry.count++;
  return true;
}

/** Record a hit against a bucket. Exposed for callers that only count failures. */
export const consumeRateLimit = rateLimit;

/** Drop a bucket entirely, e.g. after a successful login. */
export function resetRateLimit(identifier: string): void {
  delete store[identifier];
}

/** Read a bucket without consuming from it. */
export function peekRateLimit(
  identifier: string,
  maxRequests: number
): { allowed: boolean; remaining: number; resetTime: number | null } {
  const entry = store[identifier];
  if (!entry || entry.resetTime < Date.now()) {
    return { allowed: true, remaining: maxRequests, resetTime: null };
  }
  return {
    allowed: entry.count < maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetTime: entry.resetTime,
  };
}

/**
 * Get rate limit info for an identifier
 * @param identifier - Unique identifier for the rate limit
 * @param maxRequests - Maximum number of requests allowed (used to calculate remaining)
 * @returns Rate limit info with remaining requests and reset time, or null if no active limit
 */
function getRateLimitInfo(
  identifier: string,
  maxRequests: number
): { remaining: number; resetTime: number } | null {
  const entry = store[identifier];
  if (!entry || entry.resetTime < Date.now()) {
    return null;
  }
  return {
    remaining: Math.max(0, maxRequests - entry.count),
    resetTime: entry.resetTime,
  };
}

function trustedProxyHops(): number {
  const raw = process.env.CURATOR_TRUSTED_PROXY_HOPS;
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Resolve the client IP and whether it can be trusted for security decisions.
 *
 * `x-forwarded-for` is appended to by every hop, so the client controls the
 * left-hand entries. Only the entry inserted by our own outermost proxy is
 * forgery-proof, and only if we know how many proxies sit in front of us —
 * hence `CURATOR_TRUSTED_PROXY_HOPS`. Callers that gate credentials must treat
 * `trusted: false` as "no usable per-client identity" rather than keying off a
 * value the caller picked.
 */
export function resolveClientIp(request: Request): { ip: string; trusted: boolean } {
  const chain =
    request.headers
      .get('x-forwarded-for')
      ?.split(',')
      .map((part) => part.trim())
      .filter(Boolean) ?? [];

  // Explicit operator config wins. Counting from the right is what makes this
  // forgery-proof: entries the caller prepends stay to the left of the ones our
  // own proxies append.
  const hops = trustedProxyHops();
  if (hops > 0 && chain.length >= hops) {
    return { ip: chain[chain.length - hops], trusted: true };
  }

  // Vercel overwrites `x-vercel-*` on inbound requests, so this cannot be
  // spoofed — but only when we are actually running on Vercel.
  const vercel = request.headers.get('x-vercel-forwarded-for')?.trim();
  if (vercel && process.env.VERCEL) {
    return { ip: vercel.split(',')[0].trim(), trusted: true };
  }

  // Deliberately no `cf-connecting-ip` branch: any caller can send that header,
  // and it is only meaningful if every request provably passed through
  // Cloudflare. Cloudflare appends the real client IP to `x-forwarded-for`
  // anyway, so the hop count above already covers that deployment.
  return { ip: chain[0] || request.headers.get('x-real-ip')?.trim() || 'unknown', trusted: false };
}

/**
 * Create a rate limit middleware for Next.js API routes.
 *
 * Best-effort abuse throttling only: an untrusted `x-forwarded-for` still keys
 * the bucket, because collapsing unattributable traffic into one shared bucket
 * here would let a single client lock out everyone else. Endpoints where a
 * bypass has a security cost (login) must key off `resolveClientIp().trusted`
 * themselves and pair it with a global cap.
 */
export function createRateLimitMiddleware(
  maxRequests: number,
  windowMs: number,
  bucket = 'api'
) {
  return (request: Request): { allowed: boolean; headers?: Headers } => {
    const identifier = `${bucket}:${resolveClientIp(request).ip}`;

    const allowed = rateLimit(identifier, maxRequests, windowMs);

    if (!allowed) {
      const info = getRateLimitInfo(identifier, maxRequests);
      const headers = new Headers();
      if (info) {
        headers.set('X-RateLimit-Limit', maxRequests.toString());
        headers.set('X-RateLimit-Remaining', '0');
        headers.set('X-RateLimit-Reset', Math.ceil(info.resetTime / 1000).toString());
      }
      return { allowed: false, headers };
    }

    const info = getRateLimitInfo(identifier, maxRequests);
    const headers = new Headers();
    if (info) {
      headers.set('X-RateLimit-Limit', maxRequests.toString());
      headers.set('X-RateLimit-Remaining', info.remaining.toString());
      headers.set('X-RateLimit-Reset', Math.ceil(info.resetTime / 1000).toString());
    }
    return { allowed: true, headers };
  };
}

