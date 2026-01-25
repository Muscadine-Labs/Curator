import { NextRequest, NextResponse } from 'next/server';

const EXPECTED = process.env.CURATOR_PASSWORD;

/**
 * POST /api/auth/verify
 * Body: { password: string }
 * Returns 200 { ok: true } if password matches CURATOR_PASSWORD, else 401.
 */
export async function POST(req: NextRequest) {
  if (!EXPECTED || EXPECTED.length === 0) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 });
  }
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const password = typeof body?.password === 'string' ? body.password : '';
  if (password === EXPECTED) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
}
