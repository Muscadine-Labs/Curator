'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useMorphoMarkets } from '@/lib/hooks/useMorphoMarkets';
import { WalletConnect } from '@/components/WalletConnect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RatingBadge } from '@/components/morpho/RatingBadge';
import { formatCompactUSD, formatPercentage } from '@/lib/format/number';

export default function MarketsPage() {
  const { data: morphoData, isLoading, error } = useMorphoMarkets();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWhitelisted, setFilterWhitelisted] = useState(false);

  const filteredMarkets = morphoData?.markets?.filter((market) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      market.raw?.loanAsset?.symbol?.toLowerCase().includes(searchLower) ||
      market.raw?.collateralAsset?.symbol?.toLowerCase().includes(searchLower) ||
      market.id.toLowerCase().includes(searchLower);
    
    return matchesSearch && (!filterWhitelisted || market.raw?.uniqueKey);
  }) || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-bold">All Morpho Markets</h1>
                <p className="text-muted-foreground mt-1">
                  Explore all available lending and borrowing markets
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/vaults">Vaults</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link
                  href="https://docs.morpho.org"
                  target="_blank"
                  rel="noreferrer"
                  className="gap-2"
                >
                  Morpho Docs
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
              <WalletConnect />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error Loading Data</AlertTitle>
            <AlertDescription>
              {error.message || 'Failed to load market data'}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
            <CardDescription>Find markets by asset symbols or market ID</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by loan asset, collateral asset, or market ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                variant={filterWhitelisted ? 'default' : 'outline'}
                onClick={() => setFilterWhitelisted(!filterWhitelisted)}
              >
                {filterWhitelisted ? 'Show All' : 'Whitelisted Only'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Markets Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Markets ({filteredMarkets.length})
            </CardTitle>
            <CardDescription>
              Click on any market to view detailed information
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredMarkets.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs uppercase tracking-wide">
                      <TableHead className="min-w-[200px]">Market Pair</TableHead>
                      <TableHead className="min-w-[120px]">Total Supply</TableHead>
                      <TableHead className="min-w-[120px]">Total Borrow</TableHead>
                      <TableHead className="min-w-[100px]">Supply APY</TableHead>
                      <TableHead className="min-w-[100px]">Borrow APY</TableHead>
                      <TableHead className="min-w-[110px]">Utilization</TableHead>
                      <TableHead className="min-w-[140px]">Curator Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMarkets.map((market) => {
                      const supplyApy = (market.raw?.state?.supplyApy ?? 0) * 100;
                      const borrowApy = (market.raw?.state?.borrowApy ?? 0) * 100;
                      const utilization = (market.raw?.state?.utilization ?? 0) * 100;

                      return (
                        <TableRow
                          key={market.id}
                          className="hover:bg-muted/40 cursor-pointer"
                          onClick={() => window.location.href = `/markets/${market.raw?.uniqueKey || market.id}`}
                        >
                          <TableCell className="font-medium">
                            <Link
                              href={`/markets/${market.raw?.uniqueKey || market.id}`}
                              className="flex items-center gap-2 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>{market.raw?.collateralAsset?.symbol || 'Unknown'}</span>
                              <span className="text-muted-foreground">/</span>
                              <span>{market.raw?.loanAsset?.symbol || 'Unknown'}</span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            {formatCompactUSD(market.raw?.state?.supplyAssetsUsd ?? 0)}
                          </TableCell>
                          <TableCell>
                            {formatCompactUSD(market.raw?.state?.borrowAssetsUsd ?? 0)}
                          </TableCell>
                          <TableCell className="text-green-600 dark:text-green-400">
                            {supplyApy > 0 ? formatPercentage(supplyApy, 2) : '—'}
                          </TableCell>
                          <TableCell className="text-orange-600 dark:text-orange-400">
                            {borrowApy > 0 ? formatPercentage(borrowApy, 2) : '—'}
                          </TableCell>
                          <TableCell>
                            {utilization > 0 ? formatPercentage(utilization, 2) : '—'}
                          </TableCell>
                          <TableCell>
                            {market.rating ? (
                              <RatingBadge rating={market.rating} />
                            ) : (
                              <span className="text-xs text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                {searchQuery ? 'No markets found matching your search' : 'No markets available'}
              </div>
            )}
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
                href="https://docs.morpho.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Morpho Docs
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
