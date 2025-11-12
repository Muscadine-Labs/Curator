import { NextResponse } from 'next/server';

export async function GET() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Generate mock fee history
  const feeHistory = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const amount = Math.random() * 50000 + 10000; // $10K - $60K
    const token = ['USDC', 'WETH', 'cbBTC'][Math.floor(Math.random() * 3)];
    return {
      date: date.toISOString(),
      amount,
      token,
      vault: `Muscadine ${token} Vault`,
    };
  });

  const feesData = {
    totalFeesGenerated: 1500000, // $1.5M
    performanceFeeBps: 200, // 2%
    feeHistory,
  };

  return NextResponse.json(feesData);
}
