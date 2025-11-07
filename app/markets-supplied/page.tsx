'use client';

import { useMarketsSupplied } from '@/lib/hooks/useMarkets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KpiCard } from '@/components/KpiCard';
import { ChartTvl } from '@/components/ChartTvl';
import { ChartPerf } from '@/components/ChartPerf';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { formatCompactUSD, formatPercentage } from '@/lib/format/number';
import { WalletConnect } from '@/components/WalletConnect';

export default function MarketsSuppliedPage() {
  const { data, isLoading, error } = useMarketsSupplied();

  const markets = data?.markets || [];
  const totalSupplyUsd = markets.reduce((s, m) => s + (m.state?.supplyAssetsUsd || 0), 0);
  const avgUtil = markets.length
    ? markets.reduce((s, m) => s + (m.state?.utilization || 0), 0) / markets.length
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Markets Supplied</h1>
                <p className="text-muted-foreground mt-1">Markets our vaults are supplying to via allocation queues</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/markets">Morpho Markets</Link>
              </Button>
              <Button asChild>
                <Link href="/vaults">View Vaults</Link>
              </Button>
              <WalletConnect />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <KpiCard title="Total Supplied (USD)" value={totalSupplyUsd} subtitle="Across all supplied markets" format="usd" isLoading={isLoading} />
          <KpiCard title="Markets Count" value={markets.length} subtitle="Unique markets" format="number" isLoading={isLoading} />
          <KpiCard title="Avg Utilization" value={(avgUtil || 0) * 100} subtitle="Weighted average not applied" format="percentage" isLoading={isLoading} />
        </div>

        {/* Markets Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Supplied Markets</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-sm text-red-600">Failed to load markets</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Market</TableHead>
                    <TableHead>Loan / Collateral</TableHead>
                    <TableHead>LLTV</TableHead>
                    <TableHead>Supplied (USD)</TableHead>
                    <TableHead>Utilization</TableHead>
                    <TableHead>Rewards APR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {markets.map((m) => (
                    <TableRow key={m.uniqueKey}>
                      <TableCell className="font-mono text-xs">{m.uniqueKey}</TableCell>
                      <TableCell>
                        {m.loanAsset?.symbol || 'N/A'} / {m.collateralAsset?.symbol || 'N/A'}
                      </TableCell>
                      <TableCell>{m.lltv ?? '-'}</TableCell>
                      <TableCell>{formatCompactUSD(m.state?.supplyAssetsUsd || 0)}</TableCell>
                      <TableCell>{formatPercentage((m.state?.utilization || 0) * 100)}</TableCell>
                      <TableCell>
                        {m.state?.rewards && m.state.rewards.length > 0
                          ? m.state.rewards.map((r, i) => (
                              <span key={i} className="block text-green-600">{formatPercentage(r.supplyApr || 0)}</span>
                            ))
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Charts per market */}
        <div className="space-y-8">
          {markets.map((m) => (
            <Card key={m.uniqueKey}>
              <CardHeader>
                <CardTitle>
                  {m.loanAsset?.symbol || 'N/A'} / {m.collateralAsset?.symbol || 'N/A'} — {m.uniqueKey.slice(0, 10)}...
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <ChartTvl 
                    data={m.history?.tvl || []} 
                    title="Supply TVL (USD)" 
                    isLoading={isLoading && !m.history?.tvl}
                  />
                  <ChartPerf 
                    data={m.history?.supplyApy || []} 
                    title="Supply APY (%)" 
                    isLoading={isLoading && !m.history?.supplyApy}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}


