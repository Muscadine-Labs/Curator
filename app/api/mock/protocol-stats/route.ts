import { NextResponse } from 'next/server';
import { vaults } from '@/lib/config/vaults';

// Mock protocol stats
export async function GET() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Generate mock TVL trend data
  const tvlTrend = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const baseValue = 50000000; // $50M base
    const variation = Math.sin(i / 5) * 5000000; // ±$5M variation
    const trend = i * 200000; // Upward trend
    return {
      date: date.toISOString(),
      value: baseValue + variation + trend,
    };
  });

  // Generate mock fees trend data
  const feesTrend = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const baseValue = 50000; // $50K base
    const variation = Math.random() * 20000; // Random variation
    return {
      date: date.toISOString(),
      value: baseValue + variation,
    };
  });

  const stats = {
    totalDeposited: 75000000, // $75M
    totalFeesGenerated: 1500000, // $1.5M
    activeVaults: vaults.filter(v => v.status === 'active').length,
    volume30d: 25000000, // $25M
    users: 1250,
    tvlTrend,
    feesTrend,
  };

  return NextResponse.json(stats);
}
