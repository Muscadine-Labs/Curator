'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCompactUSD, formatCompactNumber } from '@/lib/format/number';
import { QUERY_STALE_TIME_MEDIUM, QUERY_REFETCH_INTERVAL_MEDIUM } from '@/lib/constants';

interface MonthlyStatementData {
  month: string;
  assets: {
    USDC: number;
    cbBTC: number;
    WETH: number;
  };
  total: number;
  isComplete: boolean;
}

interface MonthlyStatementResponse {
  statements: MonthlyStatementData[];
}

// Approximate token prices for USD to token conversion
// Note: These are approximate and may not reflect real-time prices
const TOKEN_PRICES = {
  USDC: 1, // Stablecoin, always 1:1
  cbBTC: 65000, // Approximate price in USD
  WETH: 3500, // Approximate price in USD
} as const;

type YearFilter = '2025' | '2026' | 'all';
type DisplayMode = 'usd' | 'token';

export default function MonthlyStatementPage() {
  const [yearFilter, setYearFilter] = useState<YearFilter>('all');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('usd');

  const { data, isLoading, error } = useQuery<MonthlyStatementResponse>({
    queryKey: ['monthly-statement'],
    queryFn: async () => {
      const response = await fetch('/api/monthly-statement', {
        credentials: 'omit',
      });
      if (!response.ok) throw new Error('Failed to fetch monthly statement');
      return response.json();
    },
    staleTime: QUERY_STALE_TIME_MEDIUM,
    refetchInterval: QUERY_REFETCH_INTERVAL_MEDIUM,
  });

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Filter statements by year
  const filteredStatements = useMemo(() => {
    const allStatements = data?.statements || [];
    if (yearFilter === 'all') return allStatements;
    
    return allStatements.filter(statement => {
      const [year] = statement.month.split('-');
      return year === yearFilter;
    });
  }, [data?.statements, yearFilter]);

  // Convert USD to token amounts
  const convertToToken = (usdAmount: number, asset: 'USDC' | 'cbBTC' | 'WETH'): number => {
    const price = TOKEN_PRICES[asset];
    return usdAmount / price;
  };

  // Format amount based on display mode
  const formatAmount = (usdAmount: number, asset: 'USDC' | 'cbBTC' | 'WETH'): string => {
    if (displayMode === 'token') {
      const tokenAmount = convertToToken(usdAmount, asset);
      return `${formatCompactNumber(tokenAmount)} ${asset}`;
    }
    return formatCompactUSD(usdAmount);
  };

  const statements = filteredStatements;
  const totalUSDC = statements.reduce((sum, s) => sum + s.assets.USDC, 0);
  const totalcbBTC = statements.reduce((sum, s) => sum + s.assets.cbBTC, 0);
  const totalWETH = statements.reduce((sum, s) => sum + s.assets.WETH, 0);
  const grandTotal = statements.reduce((sum, s) => sum + s.total, 0);

  return (
    <AppShell
      title="Monthly Income Statement"
      description="Monthly revenue breakdown by asset from October 1st, 2025 onwards"
    >
      <div className="space-y-6">
        {/* Controls at top left */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Tabs value={yearFilter} onValueChange={(value) => setYearFilter(value as YearFilter)}>
              <TabsList>
                <TabsTrigger value="2025">2025</TabsTrigger>
                <TabsTrigger value="2026">2026</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={displayMode === 'usd' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayMode('usd')}
            >
              USD
            </Button>
            <Button
              variant={displayMode === 'token' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayMode('token')}
            >
              Tokens
            </Button>
          </div>
        </div>
        
        {displayMode === 'token' && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
            <p className="font-medium mb-1">Note: Token amounts are approximate</p>
            <p className="text-xs">
              Conversion rates: USDC = $1, cbBTC ≈ ${TOKEN_PRICES.cbBTC.toLocaleString()}, WETH ≈ ${TOKEN_PRICES.WETH.toLocaleString()}
            </p>
          </div>
        )}
        {isLoading ? (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Income Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Income Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-64 text-red-600">
                Failed to load monthly statement data
              </div>
            </CardContent>
          </Card>
        ) : statements.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Income Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-64 text-slate-500">
                No data available for the specified period
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Monthly Income Statement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Month</TableHead>
                        <TableHead className="text-right">
                          {displayMode === 'usd' ? 'USDC Revenue' : 'USDC'}
                        </TableHead>
                        <TableHead className="text-right">
                          {displayMode === 'usd' ? 'cbBTC Revenue' : 'cbBTC'}
                        </TableHead>
                        <TableHead className="text-right">
                          {displayMode === 'usd' ? 'WETH Revenue' : 'WETH'}
                        </TableHead>
                        <TableHead className="text-right font-semibold">
                          {displayMode === 'usd' ? 'Total Revenue' : 'Total (USD)'}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statements.map((statement) => (
                        <TableRow key={statement.month}>
                          <TableCell className="font-medium">
                            {formatMonth(statement.month)}
                            {!statement.isComplete && (
                              <span className="ml-2 text-amber-500">*</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(statement.assets.USDC, 'USDC')}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(statement.assets.cbBTC, 'cbBTC')}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(statement.assets.WETH, 'WETH')}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCompactUSD(statement.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-50 font-semibold">
                        <TableCell className="font-semibold">Total</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatAmount(totalUSDC, 'USDC')}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatAmount(totalcbBTC, 'cbBTC')}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatAmount(totalWETH, 'WETH')}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCompactUSD(grandTotal)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

