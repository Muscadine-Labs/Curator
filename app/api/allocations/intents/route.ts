import { NextResponse } from 'next/server';

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

const intentsStore: AllocationIntent[] = [];

type AllocationIntentPayload = {
  vaultAddress: string;
  marketKey: string;
  action: 'allocate' | 'deallocate';
  amountUsd?: number;
  sharePct?: number;
  walletAddress?: string;
  notes?: string;
};

function assertPayload(value: unknown): asserts value is AllocationIntentPayload {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid payload');
  }
  const payload = value as Record<string, unknown>;
  if (!payload.vaultAddress || typeof payload.vaultAddress !== 'string') {
    throw new Error('vaultAddress is required');
  }
  if (!payload.marketKey || typeof payload.marketKey !== 'string') {
    throw new Error('marketKey is required');
  }
  if (payload.action !== 'allocate' && payload.action !== 'deallocate') {
    throw new Error('action must be allocate or deallocate');
  }
  if (payload.amountUsd !== undefined && typeof payload.amountUsd !== 'number') {
    throw new Error('amountUsd must be a number');
  }
  if (payload.sharePct !== undefined && typeof payload.sharePct !== 'number') {
    throw new Error('sharePct must be a number');
  }
  if (payload.walletAddress !== undefined && typeof payload.walletAddress !== 'string') {
    throw new Error('walletAddress must be a string');
  }
  if (payload.notes !== undefined && typeof payload.notes !== 'string') {
    throw new Error('notes must be a string');
  }
}

export async function GET() {
  return NextResponse.json({ intents: intentsStore.slice(0, 50) });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    assertPayload(payload);

    const intent: AllocationIntent = {
      id: crypto.randomUUID(),
      vaultAddress: payload.vaultAddress,
      marketKey: payload.marketKey,
      action: payload.action,
      amountUsd:
        typeof payload.amountUsd === 'number' ? Number(payload.amountUsd) : null,
      sharePct:
        typeof payload.sharePct === 'number' ? Number(payload.sharePct) : null,
      walletAddress: payload.walletAddress ?? null,
      notes: payload.notes ?? null,
      createdAt: new Date().toISOString(),
    };

    intentsStore.unshift(intent);

    return NextResponse.json({ intent }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}


