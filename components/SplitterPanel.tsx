import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddressBadge } from './AddressBadge';
import { useAllFeeSplitters, useRevenueSplit } from '@/lib/hooks/useRevenueSplit';
import { calculateSharePercentage } from '@/lib/onchain/contracts';
import { Address } from 'viem';

function SplitterCard({ 
  splitterAddress
}: { 
  splitterAddress: Address; 
  name: string;
}) {
  const { data: revenueSplit, isLoading, error } = useRevenueSplit(splitterAddress);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-48" />
        </div>
      </div>
    );
  }

  if (error || !revenueSplit) {
    return (
      <div className="text-sm text-muted-foreground">
        Fee splitter data unavailable
      </div>
    );
  }

  const payee1Percentage = calculateSharePercentage(revenueSplit.shares1, revenueSplit.totalShares);
  const payee2Percentage = calculateSharePercentage(revenueSplit.shares2, revenueSplit.totalShares);

  return (
    <div className="space-y-4">
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
        <div className="mt-2">
          <span className="text-xs text-muted-foreground">Contract:</span>
          <AddressBadge 
            address={splitterAddress} 
            scanUrl={`https://basescan.org/address/${splitterAddress}`}
          />
        </div>
      </div>
    </div>
  );
}

export function SplitterPanel() {
  const { data: allSplitters, isLoading } = useAllFeeSplitters();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fee Splitters</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!allSplitters || allSplitters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fee Splitters</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No fee splitters configured
          </p>
        </CardContent>
      </Card>
    );
  }

  // If only one splitter, show it directly
  if (allSplitters.length === 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fee Splitter</CardTitle>
        </CardHeader>
        <CardContent>
          <SplitterCard 
            splitterAddress={allSplitters[0].address} 
            name={allSplitters[0].name}
          />
        </CardContent>
      </Card>
    );
  }

  // Multiple splitters - show in tabs
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fee Splitters</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={allSplitters[0]?.address || ''}>
          <TabsList className="grid w-full grid-cols-2">
            {allSplitters.map((splitter) => (
              <TabsTrigger key={splitter.address} value={splitter.address}>
                {splitter.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {allSplitters.map((splitter) => (
            <TabsContent key={splitter.address} value={splitter.address}>
              <SplitterCard 
                splitterAddress={splitter.address} 
                name={splitter.name}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
