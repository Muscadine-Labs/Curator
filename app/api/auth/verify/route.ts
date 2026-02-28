import { NextRequest, NextResponse } from 'next/server';

const OWNER_PASSWORD = process.env.CURATOR_OWNER_PASSWORD;

/**
 * POST /api/auth/verify
 * Body: { username: string, password: string }
 * Returns 200 { ok: true, role: 'owner' } if credentials match, else 401.
 */
export async function POST(req: NextRequest) {
  if (!OWNER_PASSWORD) {
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

  // Check owner credentials (case-sensitive: "Owner")
  if (username === 'Owner' && password === OWNER_PASSWORD) {
    return NextResponse.json({ ok: true, role: 'owner' });
  }

  return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
}
