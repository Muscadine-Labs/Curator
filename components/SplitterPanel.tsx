import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AddressBadge } from './AddressBadge';
import { useRevenueSplit } from '@/lib/hooks/useRevenueSplit';
import { calculateSharePercentage } from '@/lib/onchain/contracts';

export function SplitterPanel() {
  const { data: revenueSplit, isLoading, error } = useRevenueSplit();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fee Splitter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-48" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !revenueSplit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fee Splitter</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Fee splitter data unavailable
          </p>
        </CardContent>
      </Card>
    );
  }

  const payee1Percentage = calculateSharePercentage(revenueSplit.shares1, revenueSplit.totalShares);
  const payee2Percentage = calculateSharePercentage(revenueSplit.shares2, revenueSplit.totalShares);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fee Splitter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Payee 1</span>
            <Badge variant="outline">{payee1Percentage.toFixed(1)}%</Badge>
          </div>
          <AddressBadge 
            address={revenueSplit.payee1 || '0x0000000000000000000000000000000000000000'} 
            scanUrl={`https://basescan.org/address/${revenueSplit.payee1}`}
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Payee 2</span>
            <Badge variant="outline">{payee2Percentage.toFixed(1)}%</Badge>
          </div>
          <AddressBadge 
            address={revenueSplit.payee2 || '0x0000000000000000000000000000000000000000'} 
            scanUrl={`https://basescan.org/address/${revenueSplit.payee2}`}
          />
        </div>
        
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Shares</span>
            <span className="font-mono">{revenueSplit.totalShares?.toString() || 'N/A'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
