'use client';

import { KpiCard } from '@/components/KpiCard';
import { ChartTvl } from '@/components/ChartTvl';
import { ChartFees } from '@/components/ChartFees';
import { ChartRevenue } from '@/components/ChartRevenue';
import { ChartInflows } from '@/components/ChartInflows';
import { useProtocolStats } from '@/lib/hooks/useProtocolStats';
import { AppShell } from '@/components/layout/AppShell';

export default function Home() {
  const { data: stats, isLoading } = useProtocolStats();

  return (
    <AppShell
      title="Overview"
      description="Select a vault from the sidebar to view risk and configuration."
    >
      <div className="space-y-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            title="Total Deposited"
            value={stats?.totalDeposited || 0}
            subtitle="Across all vaults"
            isLoading={isLoading}
            format="usd"
          />
          <KpiCard
            title="Total Interest Generated"
            value={stats?.totalInterestGenerated || 0}
            subtitle="Depositor earnings"
            isLoading={isLoading}
            format="usd"
          />
          <KpiCard
            title="Total Revenue Generated"
            value={stats?.totalFeesGenerated || 0}
            subtitle="Curator fees"
            isLoading={isLoading}
            format="usd"
          />
          <KpiCard
            title="Active Vaults"
            value={stats?.activeVaults || 0}
            subtitle="Currently active"
            isLoading={isLoading}
            format="number"
          />
          <KpiCard
            title="Users"
            value={stats?.users || 0}
            subtitle="Total depositors"
            isLoading={isLoading}
            format="number"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartTvl
            totalData={stats?.tvlTrend}
            coinData={stats?.tvlByCoin}
            isLoading={isLoading}
            title="TVL Over Time"
          />
          <ChartInflows
            dailyData={stats?.inflowsTrendDaily}
            cumulativeData={stats?.inflowsTrendCumulative}
            isLoading={isLoading}
            title="Inflows"
          />
          <ChartFees
            dailyData={stats?.feesTrendDaily}
            cumulativeData={stats?.feesTrendCumulative}
            isLoading={isLoading}
            title="Fees"
          />
          <ChartRevenue
            dailyData={stats?.revenueTrendDaily}
            cumulativeData={stats?.revenueTrendCumulative}
            isLoading={isLoading}
            title="Revenue"
          />
        </div>
      </div>
    </AppShell>
  );
}
