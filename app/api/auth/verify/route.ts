import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, passwordsMatch, sessionSetCookieHeader } from '@/lib/auth/session';
import { createRateLimitMiddleware } from '@/lib/utils/rate-limit';
import { AUTH_LOGIN_MAX_ATTEMPTS, AUTH_LOGIN_WINDOW_MS } from '@/lib/constants';

const ADMIN_PASSWORD = process.env.CURATOR_ADMIN_PASSWORD || process.env.CURATOR_OWNER_PASSWORD;

/**
 * POST /api/auth/verify
 * Body: { username: string, password: string }
 * Returns 200 { ok: true, role: 'admin' } if credentials match, else 401.
 * Sets an HttpOnly session cookie. The only valid username is "admin".
 */
export async function POST(req: NextRequest) {
  const rateLimit = createRateLimitMiddleware(
    AUTH_LOGIN_MAX_ATTEMPTS,
    AUTH_LOGIN_WINDOW_MS,
    'auth-verify'
  )(req);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again later.' },
      { status: 429, headers: rateLimit.headers }
    );
  }

  if (!ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 });
  }
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (username === 'admin' && passwordsMatch(password, ADMIN_PASSWORD)) {
    try {
      const token = await createSessionToken();
      const res = NextResponse.json({ ok: true, role: 'admin' });
      res.headers.append('Set-Cookie', sessionSetCookieHeader(token));
      return res;
    } catch {
      return NextResponse.json({ error: 'Auth not configured' }, { status: 503 });
    }
  }

  return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
}
