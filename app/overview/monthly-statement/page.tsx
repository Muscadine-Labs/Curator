'use client';

import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCompactUSD } from '@/lib/format/number';
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

export default function MonthlyStatementPage() {
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

  const statements = data?.statements || [];
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
                        <TableHead className="text-right">USDC Revenue</TableHead>
                        <TableHead className="text-right">cbBTC Revenue</TableHead>
                        <TableHead className="text-right">WETH Revenue</TableHead>
                        <TableHead className="text-right font-semibold">Total Revenue</TableHead>
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
                            {formatCompactUSD(statement.assets.USDC)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCompactUSD(statement.assets.cbBTC)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCompactUSD(statement.assets.WETH)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCompactUSD(statement.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-50 font-semibold">
                        <TableCell className="font-semibold">Total</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCompactUSD(totalUSDC)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCompactUSD(totalcbBTC)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCompactUSD(totalWETH)}
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

