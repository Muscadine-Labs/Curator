'use client';

import { KpiCard } from '@/components/KpiCard';
import { ChartTvl } from '@/components/ChartTvl';
import { ChartFees } from '@/components/ChartFees';
import { useProtocolStats } from '@/lib/hooks/useProtocolStats';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const { data: stats, isLoading } = useProtocolStats();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Muscadine Curator</h1>
              <p className="text-muted-foreground mt-1">
                Explore Muscadine vaults and track performance
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" asChild>
                <Link href="/vaults">View All Vaults</Link>
              </Button>
              <Button asChild>
                <Link href="/fees">Fee Splitter</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Protocol KPIs */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-6">Protocol Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <KpiCard
              title="Total Deposited"
              value={stats?.totalDeposited || 0}
              subtitle="Across all vaults"
              isLoading={isLoading}
              format="usd"
            />
            <KpiCard
              title="Total Fees Generated"
              value={stats?.totalFeesGenerated || 0}
              subtitle="Lifetime fees"
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
              title="30d Volume"
              value={stats?.volume30d || 0}
              subtitle="Monthly volume"
              isLoading={isLoading}
              format="usd"
            />
            <KpiCard
              title="Users"
              value={stats?.users || 0}
              subtitle="Total depositors"
              isLoading={isLoading}
              format="number"
            />
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <ChartTvl 
            data={stats?.tvlTrend || []} 
            isLoading={isLoading}
            title="TVL Over Time"
          />
          <ChartFees 
            data={stats?.feesTrend || []} 
            isLoading={isLoading}
            title="Fees Over Time"
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-muted/50 rounded-lg p-8">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">Ready to explore?</h3>
            <p className="text-muted-foreground mb-6">
              Discover Muscadine vaults and start earning yield on your assets
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/vaults" className="flex items-center gap-2">
                  Explore Vaults
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/fees" className="flex items-center gap-2">
                  View Fee Splitter
                  <TrendingUp className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              © 2024 Muscadine. Built on Base.
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a 
                href="https://basescan.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Base Explorer
              </a>
              <a 
                href="https://app.safe.global" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Safe
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
