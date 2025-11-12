import { NextRequest, NextResponse } from 'next/server';
import { getVaultById } from '@/lib/config/vaults';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const vault = getVaultById(id);
  
  if (!vault) {
    return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
  }

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Generate mock TVL chart data
  const tvlChart = Array.from({ length: 90 }, (_, i) => {
    const date = new Date(ninetyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const baseValue = 20000000; // $20M base
    const variation = Math.sin(i / 10) * 3000000; // ±$3M variation
    const trend = i * 100000; // Upward trend
    return {
      date: date.toISOString(),
      value: baseValue + variation + trend,
    };
  });

  // Generate mock performance index chart data
  const performanceChart = Array.from({ length: 90 }, (_, i) => {
    const date = new Date(ninetyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const baseValue = 1.0; // Starting at 1.0
    const cumulativeReturn = i * 0.0005; // Slight upward trend
    return {
      date: date.toISOString(),
      value: baseValue + cumulativeReturn + (Math.random() - 0.5) * 0.1,
    };
  });

  // Generate mock fees chart data
  const feesChart = Array.from({ length: 90 }, (_, i) => {
    const date = new Date(ninetyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const baseValue = 1000; // $1K base
    const variation = Math.random() * 500; // Random variation
    return {
      date: date.toISOString(),
      value: baseValue + variation,
    };
  });

  const vaultData = {
    ...vault,
    tvl: Math.random() * 25000000 + 10000000, // $10M - $35M
    apyBase: Math.random() * 3 + 2, // 2% - 5%
    apyBoosted: Math.random() * 2 + 5, // 5% - 7%
    depositors: Math.floor(Math.random() * 500) + 50, // 50 - 550
    feesYtd: Math.random() * 100000 + 50000, // $50K - $150K
    lastHarvest: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    utilization: Math.random() * 0.3 + 0.7, // 70% - 100%
    charts: {
      tvl: tvlChart,
      performance: performanceChart,
      fees: feesChart,
    },
    parameters: {
      performanceFeeBps: vault.performanceFeeBps,
      maxDeposit: null, // No cap
      maxWithdrawal: null, // No cap
      strategyNotes: `This vault implements a ${vault.riskTier} risk strategy for ${vault.asset} tokens.`,
    },
  };

  return NextResponse.json(vaultData);
}
