'use client';

import { useParams } from 'next/navigation';
import { useVault } from '@/lib/hooks/useProtocolStats';
import { KpiCard } from '@/components/KpiCard';
import { RoleList } from '@/components/RoleList';
import { AllocatorList } from '@/components/AllocatorList';
import { AddressBadge } from '@/components/AddressBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { formatCompactUSD, formatPercentage, formatRelativeTime } from '@/lib/format/number';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WalletConnect } from '@/components/WalletConnect';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function VaultDetailPage() {
  const params = useParams();
  const vaultId = params.id as string;
  const { data: vault, isLoading } = useVault(vaultId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-muted rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Vault Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The vault you&apos;re looking for doesn&apos;t exist.
            </p>
            <Button asChild>
              <Link href="/vaults">Back to Vaults</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/vaults" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Vaults
                </Link>
              </Button>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{vault.name}</h1>
                  <Badge variant="outline">{vault.symbol}</Badge>
                  <Badge 
                    variant={vault.status === 'active' ? 'default' : 'secondary'}
                    className={
                      vault.status === 'active' 
                        ? 'bg-green-100 text-green-800 hover:bg-green-100' 
                        : ''
                    }
                  >
                    {vault.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <AddressBadge 
                    address={vault.address} 
                    scanUrl={vault.scanUrl}
                  />
                  <Badge variant="outline">Base</Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/markets">All Markets</Link>
              </Button>
              <Button variant="outline" size="sm" disabled>
                Deposit (Coming Soon)
              </Button>
              <Button variant="outline" size="sm" disabled>
                Withdraw (Coming Soon)
              </Button>
              <WalletConnect />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KpiCard
            title="TVL"
            value={vault.tvl}
            subtitle="Total Value Locked"
            format="usd"
          />
          <KpiCard
            title="Base APY"
            value={vault.apyBase}
            subtitle="Base yield rate"
            format="percentage"
          />
          <KpiCard
            title="Boosted APY"
            value={vault.apyBoosted}
            subtitle="With boost"
            format="percentage"
          />
          <KpiCard
            title="Depositors"
            value={vault.depositors}
            subtitle="Total depositors"
            format="number"
          />
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <KpiCard
            title="Fees YTD"
            value={vault.feesYtd}
            subtitle="Year to date"
            format="usd"
          />
          <KpiCard
            title="Utilization"
            value={vault.utilization * 100}
            subtitle="Capital utilization"
            format="percentage"
          />
          <KpiCard
            title="Last Harvest"
            value={formatRelativeTime(vault.lastHarvest)}
            subtitle="Most recent harvest"
            format="raw"
          />
        </div>

        {/* APY Breakdown */}
        {vault.apyBreakdown && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>APY Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard title="Avg APY" value={vault.apyBreakdown.avgApy} format="percentage" subtitle="6h avg" />
                <KpiCard title="Avg Net APY" value={vault.apyBreakdown.avgNetApy} format="percentage" subtitle="6h avg" />
                <KpiCard title="Daily Net" value={vault.apyBreakdown.dailyNetApy} format="percentage" subtitle="24h" />
                <KpiCard title="Weekly Net" value={vault.apyBreakdown.weeklyNetApy} format="percentage" subtitle="7d" />
                <KpiCard title="Monthly Net" value={vault.apyBreakdown.monthlyNetApy} format="percentage" subtitle="30d" />
                <KpiCard title="Underlying APR" value={vault.apyBreakdown.underlyingYieldApr} format="percentage" subtitle="Token yield" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rewards */}
        {vault.rewards && vault.rewards.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Vault Rewards</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reward Token</TableHead>
                    <TableHead>APR</TableHead>
                    <TableHead>Yearly Tokens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vault.rewards.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{r.assetAddress}</TableCell>
                      <TableCell className="text-green-600">{formatPercentage(r.supplyApr)}</TableCell>
                      <TableCell>{r.yearlySupplyTokens.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Queues & Warnings */}
        {(vault.queues || (vault.warnings && vault.warnings.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {vault.queues && (
              <Card>
                <CardHeader>
                  <CardTitle>Queues</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Supply Queue Index</div>
                    <div className="text-lg font-semibold">{vault.queues.supplyQueueIndex ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Withdraw Queue Index</div>
                    <div className="text-lg font-semibold">{vault.queues.withdrawQueueIndex ?? '-'}</div>
                  </div>
                </CardContent>
              </Card>
            )}
            {vault.warnings && vault.warnings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Warnings</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {vault.warnings.map((w, i) => (
                    <Badge key={i} variant={w.level === 'RED' ? 'destructive' : 'secondary'}>
                      {w.type}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Historical Performance Charts */}
        {vault.historicalData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* APY History Chart */}
            {vault.historicalData.apy && vault.historicalData.apy.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>APY History (30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart 
                      data={vault.historicalData.apy.map((d: { x: number; y: number }) => ({
                        date: new Date(d.x * 1000).toLocaleDateString(),
                        apy: d.y * 100,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        className="text-xs"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        className="text-xs"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => `${value.toFixed(1)}%`}
                      />
                      <Tooltip 
                        formatter={(value: number) => `${value.toFixed(2)}%`}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))' 
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="apy" 
                        name="Base APY"
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Net APY History Chart */}
            {vault.historicalData.netApy && vault.historicalData.netApy.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Net APY History (30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart 
                      data={vault.historicalData.netApy.map((d: { x: number; y: number }) => ({
                        date: new Date(d.x * 1000).toLocaleDateString(),
                        netApy: d.y * 100,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        className="text-xs"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        className="text-xs"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => `${value.toFixed(1)}%`}
                      />
                      <Tooltip 
                        formatter={(value: number) => `${value.toFixed(2)}%`}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))' 
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="netApy" 
                        name="Net APY (w/ rewards)"
                        stroke="hsl(var(--chart-2))" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* TVL History Chart */}
            {vault.historicalData.totalAssetsUsd && vault.historicalData.totalAssetsUsd.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Total Value Locked History (30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart 
                      data={vault.historicalData.totalAssetsUsd.map((d: { x: number; y: number }) => ({
                        date: new Date(d.x * 1000).toLocaleDateString(),
                        tvl: d.y,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        className="text-xs"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        className="text-xs"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => formatCompactUSD(value)}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCompactUSD(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))' 
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="tvl" 
                        name="Total Value Locked"
                        stroke="hsl(var(--chart-1))" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Allocation with clickable market links */}
        {vault.allocation && vault.allocation.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Market Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Market</TableHead>
                    <TableHead>Loan / Collateral</TableHead>
                    <TableHead>LLTV</TableHead>
                    <TableHead>Supply (USD)</TableHead>
                    <TableHead>Rewards APR</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vault.allocation.map((a, i) => {
                    const marketLink = a.marketKey || '';
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">
                          <Link 
                            href={`/markets/${marketLink}`}
                            className="hover:underline text-primary"
                          >
                            {marketLink.slice(0, 8)}...{marketLink.slice(-6)}
                          </Link>
                        </TableCell>
                        <TableCell>{a.loanAssetName} / {a.collateralAssetName}</TableCell>
                        <TableCell>{a.lltv ? formatPercentage(a.lltv * 100, 0) : '-'}</TableCell>
                        <TableCell>{formatCompactUSD(a.supplyAssetsUsd || 0)}</TableCell>
                        <TableCell>
                          {a.marketRewards && a.marketRewards.length > 0
                            ? a.marketRewards.map((mr, idx) => (
                                <span key={idx} className="block text-green-600">
                                  {formatPercentage(mr.supplyApr)}
                                </span>
                              ))
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/markets/${marketLink}`}>
                              View Market
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Vault Metadata */}
        {vault.metadata && (vault.metadata.curators || vault.metadata.forumLink) && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Vault Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {vault.metadata.curators && vault.metadata.curators.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Curators</label>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {vault.metadata.curators.map((curator: { image?: string | null; name?: string | null; url?: string | null }, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg border">
                        {curator.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img 
                            src={curator.image} 
                            alt={curator.name || 'Curator'} 
                            className="w-8 h-8 rounded-full"
                          />
                        )}
                        <div>
                          <div className="font-medium text-sm">{curator.name}</div>
                          {curator.url && (
                            <a 
                              href={curator.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              Visit
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {vault.metadata.forumLink && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Forum Discussion</label>
                  <div className="mt-1">
                    <Button variant="outline" size="sm" asChild>
                      <a 
                        href={vault.metadata.forumLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        View Forum Post
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Transactions */}
        {vault.transactions && vault.transactions.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Block</TableHead>
                    <TableHead>Hash</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vault.transactions.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>{t.type}</TableCell>
                      <TableCell>{t.blockNumber}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <a className="underline" target="_blank" rel="noreferrer" href={`https://basescan.org/tx/${t.hash}`}>{t.hash.slice(0, 10)}...</a>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.userAddress || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Charts - Historical data not yet available via Morpho API */}

        {/* Roles and Parameters */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <RoleList />
          <AllocatorList />
        </div>

        {/* Parameters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Vault Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Performance Fee</label>
                <p className="text-lg font-semibold">{formatPercentage(vault.parameters.performanceFeeBps)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Max Deposit</label>
                <p className="text-lg font-semibold">
                  {vault.parameters.maxDeposit ? formatCompactUSD(vault.parameters.maxDeposit) : 'No limit'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Max Withdrawal</label>
                <p className="text-lg font-semibold">
                  {vault.parameters.maxWithdrawal ? formatCompactUSD(vault.parameters.maxWithdrawal) : 'No limit'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Risk Tier</label>
                <Badge variant="outline" className="text-lg">
                  {vault.riskTier}
                </Badge>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Strategy Notes</label>
              <p className="text-sm mt-1">{vault.parameters.strategyNotes}</p>
            </div>
          </CardContent>
        </Card>

        {/* Contract Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contract Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Vault Contract</label>
              <AddressBadge 
                address={vault.address} 
                scanUrl={vault.scanUrl}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Asset Contract</label>
              <p className="text-sm text-muted-foreground">
                Asset contract address would be displayed here when available
              </p>
            </div>
            
            <div className="flex items-center gap-4 pt-4 border-t">
              <Button variant="outline" size="sm" disabled>
                View ABI (Coming Soon)
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={vault.scanUrl} target="_blank" rel="noopener noreferrer">
                  View on Basescan
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
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
