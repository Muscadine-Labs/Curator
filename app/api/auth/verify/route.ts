import { NextRequest, NextResponse } from 'next/server';

const OWNER_PASSWORD = process.env.CURATOR_OWNER_PASSWORD;
const INTERN_PASSWORD = process.env.CURATOR_INTERN_PASSWORD;

/**
 * POST /api/auth/verify
 * Body: { username: string, password: string }
 * Returns 200 { ok: true, role: 'owner' | 'intern' } if credentials match, else 401.
 */
export async function POST(req: NextRequest) {
  if (!OWNER_PASSWORD || !INTERN_PASSWORD) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 });
  }
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  // Check owner credentials
  if (username === 'owner' && password === OWNER_PASSWORD) {
    return NextResponse.json({ ok: true, role: 'owner' });
  }

  // Check intern credentials
  if (username === 'intern' && password === INTERN_PASSWORD) {
    return NextResponse.json({ ok: true, role: 'intern' });
  }

  return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
}
