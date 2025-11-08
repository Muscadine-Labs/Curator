'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddressBadge } from '@/components/AddressBadge';
import { KpiCard } from '@/components/KpiCard';
import { formatCompactUSD, formatPercentage } from '@/lib/format/number';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MarketComprehensiveDataProps {
  marketId: string;
}

interface MarketData {
  warnings?: Array<{ type: string; level: string }>;
  state?: {
    supplyAssetsUsd?: number;
    supplyAssets?: number;
    borrowAssetsUsd?: number;
    borrowAssets?: number;
    liquidityAssetsUsd?: number;
    liquidityAssets?: number;
    collateralAssetsUsd?: number;
    collateralAssets?: number;
    supplyApy?: number;
    borrowApy?: number;
    utilization?: number;
    fee?: number;
    rewards?: Array<{
      asset?: { symbol?: string };
      supplyApr?: number;
      borrowApr?: number;
      yearlySupplyTokens?: number;
      yearlyBorrowTokens?: number;
    }>;
  };
  loanAsset?: { symbol?: string; name?: string; address?: string; priceUsd?: number };
  collateralAsset?: { symbol?: string; name?: string; address?: string; priceUsd?: number };
  historicalData?: {
    supplyApy?: Array<{ x: number; y: number }>;
    borrowApy?: Array<{ x: number; y: number }>;
    supplyAssetsUsd?: Array<{ x: number; y: number }>;
    borrowAssetsUsd?: Array<{ x: number; y: number }>;
  };
  supplyingVaults?: Array<{ name?: string; symbol?: string; address?: string }>;
  positions?: Array<{
    userAddress?: string;
    supplyAssetsUsd?: number;
    supplyAssets?: number;
    borrowAssetsUsd?: number;
    borrowAssets?: number;
    collateralUsd?: number;
    collateral?: number;
  }>;
  liquidations?: Array<{
    blockNumber?: number;
    repaidAssetsUsd?: number;
    seizedAssetsUsd?: number;
    badDebtAssetsUsd?: number;
    hash?: string;
  }>;
}

export function MarketComprehensiveData({ marketId }: MarketComprehensiveDataProps) {
  const [data, setData] = useState<MarketData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/markets/${marketId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch market data');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [marketId]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Market Data</AlertTitle>
        <AlertDescription>{error || 'Failed to load comprehensive market data'}</AlertDescription>
      </Alert>
    );
  }

  const supplyApyChartData = data.historicalData?.supplyApy?.map((d) => ({
    date: new Date(d.x * 1000).toLocaleDateString(),
    supplyApy: d.y * 100,
  })) || [];

  const borrowApyChartData = data.historicalData?.borrowApy?.map((d) => ({
    date: new Date(d.x * 1000).toLocaleDateString(),
    borrowApy: d.y * 100,
  })) || [];

  const tvlChartData = data.historicalData?.supplyAssetsUsd?.map((d, idx) => ({
    date: new Date(d.x * 1000).toLocaleDateString(),
    supply: d.y,
    borrow: data.historicalData?.borrowAssetsUsd?.[idx]?.y || 0,
  })) || [];

  return (
    <div className="space-y-8">
      {/* Warnings */}
      {data.warnings && data.warnings.length > 0 && (
        <Alert variant={data.warnings.some((w) => w.level === 'RED') ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Market Warnings</AlertTitle>
          <AlertDescription>
            <div className="flex flex-wrap gap-2 mt-2">
              {data.warnings.map((w, i) => (
                <Badge key={i} variant={w.level === 'RED' ? 'destructive' : 'secondary'}>
                  {w.type}
                </Badge>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          title="Total Supply"
          value={data.state?.supplyAssetsUsd || 0}
          subtitle={`${(data.state?.supplyAssets || 0).toFixed(2)} ${data.loanAsset?.symbol}`}
          format="usd"
        />
        <KpiCard
          title="Total Borrow"
          value={data.state?.borrowAssetsUsd || 0}
          subtitle={`${(data.state?.borrowAssets || 0).toFixed(2)} ${data.loanAsset?.symbol}`}
          format="usd"
        />
        <KpiCard
          title="Available Liquidity"
          value={data.state?.liquidityAssetsUsd || 0}
          subtitle={`${(data.state?.liquidityAssets || 0).toFixed(2)} ${data.loanAsset?.symbol}`}
          format="usd"
        />
        <KpiCard
          title="Total Collateral"
          value={data.state?.collateralAssetsUsd || 0}
          subtitle={`${(data.state?.collateralAssets || 0).toFixed(2)} ${data.collateralAsset?.symbol}`}
          format="usd"
        />
      </div>

      {/* APY Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          title="Supply APY"
          value={(data.state?.supplyApy || 0) * 100}
          subtitle="Current rate"
          format="percentage"
        />
        <KpiCard
          title="Borrow APY"
          value={(data.state?.borrowApy || 0) * 100}
          subtitle="Current rate"
          format="percentage"
        />
        <KpiCard
          title="Utilization"
          value={(data.state?.utilization || 0) * 100}
          subtitle="Capital efficiency"
          format="percentage"
        />
        <KpiCard
          title="Market Fee"
          value={(data.state?.fee || 0) * 100}
          subtitle="Protocol fee"
          format="percentage"
        />
      </div>

      {/* Tabs for Different Data Views */}
      <Tabs defaultValue="charts" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="vaults">Vaults</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="liquidations">Liquidations</TabsTrigger>
        </TabsList>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {supplyApyChartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Supply APY History (30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={supplyApyChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                      <YAxis
                        className="text-xs"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => `${value.toFixed(1)}%`}
                      />
                      <Tooltip
                        formatter={(value: number) => `${value.toFixed(2)}%`}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="supplyApy"
                        name="Supply APY"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {borrowApyChartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Borrow APY History (30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={borrowApyChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                      <YAxis
                        className="text-xs"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => `${value.toFixed(1)}%`}
                      />
                      <Tooltip
                        formatter={(value: number) => `${value.toFixed(2)}%`}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="borrowApy"
                        name="Borrow APY"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {tvlChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Market Size History (30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={tvlChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis
                      className="text-xs"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => `$${(value / 1e6).toFixed(1)}M`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCompactUSD(value)}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="supply"
                      name="Total Supply"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="borrow"
                      name="Total Borrow"
                      stroke="hsl(var(--destructive))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards">
          {data.state?.rewards && data.state.rewards.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Market Rewards</CardTitle>
                <CardDescription>Additional incentives for this market</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead>Supply APR</TableHead>
                      <TableHead>Borrow APR</TableHead>
                      <TableHead>Yearly Supply</TableHead>
                      <TableHead>Yearly Borrow</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.state.rewards.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.asset?.symbol}</TableCell>
                        <TableCell className="text-green-600">{formatPercentage(r.supplyApr || 0, 2)}</TableCell>
                        <TableCell className="text-green-600">{formatPercentage(r.borrowApr || 0, 2)}</TableCell>
                        <TableCell>{r.yearlySupplyTokens?.toLocaleString() || '-'}</TableCell>
                        <TableCell>{r.yearlyBorrowTokens?.toLocaleString() || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No active rewards for this market
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Vaults Tab */}
        <TabsContent value="vaults">
          {data.supplyingVaults && data.supplyingVaults.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Vaults Supplying to This Market</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.supplyingVaults.map((vault, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <div className="font-medium">{vault.name}</div>
                      <div className="text-sm text-muted-foreground">{vault.symbol}</div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/vaults/${vault.address}`}>View Vault</Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No vaults currently supplying to this market
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Positions Tab */}
        <TabsContent value="positions">
          {data.positions && data.positions.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Top Positions</CardTitle>
                <CardDescription>Largest suppliers and borrowers</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Supply</TableHead>
                      <TableHead>Borrow</TableHead>
                      <TableHead>Collateral</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.positions.slice(0, 20).map((pos, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <AddressBadge
                            address={pos.userAddress || ''}
                            scanUrl={`https://basescan.org/address/${pos.userAddress}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div>{formatCompactUSD(pos.supplyAssetsUsd || 0)}</div>
                          <div className="text-xs text-muted-foreground">
                            {(pos.supplyAssets || 0).toFixed(4)} {data.loanAsset?.symbol}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{formatCompactUSD(pos.borrowAssetsUsd || 0)}</div>
                          <div className="text-xs text-muted-foreground">
                            {(pos.borrowAssets || 0).toFixed(4)} {data.loanAsset?.symbol}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{formatCompactUSD(pos.collateralUsd || 0)}</div>
                          <div className="text-xs text-muted-foreground">
                            {(pos.collateral || 0).toFixed(4)} {data.collateralAsset?.symbol}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No position data available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Liquidations Tab */}
        <TabsContent value="liquidations">
          {data.liquidations && data.liquidations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Recent Liquidations</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Block</TableHead>
                      <TableHead>Repaid</TableHead>
                      <TableHead>Seized</TableHead>
                      <TableHead>Bad Debt</TableHead>
                      <TableHead>Tx</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.liquidations.map((liq, i) => (
                      <TableRow key={i}>
                        <TableCell>{liq.blockNumber}</TableCell>
                        <TableCell>{formatCompactUSD(liq.repaidAssetsUsd || 0)}</TableCell>
                        <TableCell>{formatCompactUSD(liq.seizedAssetsUsd || 0)}</TableCell>
                        <TableCell>
                          {(liq.badDebtAssetsUsd || 0) > 0 ? (
                            <span className="text-red-600">{formatCompactUSD(liq.badDebtAssetsUsd || 0)}</span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <a
                            href={`https://basescan.org/tx/${liq.hash || ''}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs underline"
                          >
                            {liq.hash?.slice(0, 8)}...
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No recent liquidations
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Asset Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Loan Asset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Symbol:</span>
              <span className="font-medium">{data.loanAsset?.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium">{data.loanAsset?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price:</span>
              <span className="font-medium">
                {data.loanAsset?.priceUsd ? formatCompactUSD(data.loanAsset.priceUsd) : 'N/A'}
              </span>
            </div>
              <div>
                <span className="text-sm text-muted-foreground">Address:</span>
                <div className="mt-1">
                  <AddressBadge
                    address={data.loanAsset?.address || ''}
                    scanUrl={`https://basescan.org/address/${data.loanAsset?.address}`}
                  />
                </div>
              </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Collateral Asset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Symbol:</span>
              <span className="font-medium">{data.collateralAsset?.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium">{data.collateralAsset?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price:</span>
              <span className="font-medium">
                {data.collateralAsset?.priceUsd ? formatCompactUSD(data.collateralAsset.priceUsd) : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Address:</span>
              <div className="mt-1">
                <AddressBadge
                  address={data.collateralAsset?.address || ''}
                  scanUrl={`https://basescan.org/address/${data.collateralAsset?.address}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

