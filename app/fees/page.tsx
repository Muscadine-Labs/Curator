'use client';

import { SplitterPanel } from '@/components/SplitterPanel';
import { PendingTokenPanel } from '@/components/PendingTokenPanel';
import { useFeesData } from '@/lib/hooks/useProtocolStats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { formatCompactUSD, formatDate } from '@/lib/format/number';
import { WalletConnect } from '@/components/WalletConnect';

export default function FeesPage() {
  const { data: feesData, isLoading: feesLoading } = useFeesData();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
                <h1 className="text-3xl font-bold">Performance Fees & Split</h1>
                <p className="text-muted-foreground mt-1">
                  Muscadine V1 vaults charge a 2% performance fee
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/vaults">Vaults</Link>
              </Button>
              <WalletConnect />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Fee Splitter and Pending Tokens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <SplitterPanel />
          <PendingTokenPanel />
        </div>

        {/* Fee History */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Fee History</CardTitle>
          </CardHeader>
          <CardContent>
            {feesLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Vault</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feesData?.feeHistory.slice(0, 10).map((fee, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatDate(fee.date)}</TableCell>
                      <TableCell>{formatCompactUSD(fee.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{fee.token}</Badge>
                      </TableCell>
                      <TableCell>{fee.vault}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Total Fees Generated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {feesLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  formatCompactUSD(feesData?.totalFeesGenerated || 0)
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Lifetime performance fees collected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Fee Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                2.00%
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Applied to all Muscadine V1 vaults
              </p>
            </CardContent>
          </Card>
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
