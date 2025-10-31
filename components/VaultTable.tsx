import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCompactUSD, formatPercentage, formatCompactNumber, formatRelativeTime, formatTokenAmount } from '@/lib/format/number';
import { VaultWithData } from '@/lib/hooks/useProtocolStats';
import Link from 'next/link';

interface VaultTableProps {
  vaults: VaultWithData[];
  isLoading?: boolean;
}

export function VaultTable({ vaults, isLoading = false }: VaultTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vaults</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vaults</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>TVL</TableHead>
              <TableHead>7d APY</TableHead>
              <TableHead>30d APY</TableHead>
              <TableHead>Depositors</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Harvest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vaults.map((vault) => (
              <TableRow key={vault.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link href={`/vaults/${vault.id}`} className="hover:underline">
                    <div>
                      <div className="font-medium">{vault.name}</div>
                      <div className="text-sm text-muted-foreground">{vault.symbol}</div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{vault.asset}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <div className="font-medium">{formatCompactUSD(vault.tvl)}</div>
                    {vault.tokenAmount && (
                      <div className="text-sm text-muted-foreground">
                        {formatTokenAmount(BigInt(vault.tokenAmount), vault.assetDecimals, 2)} {vault.asset}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-green-600">
                  {formatPercentage(vault.apy7d)}
                </TableCell>
                <TableCell className="text-green-600">
                  {formatPercentage(vault.apy30d)}
                </TableCell>
                <TableCell>{formatCompactNumber(vault.depositors)}</TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatRelativeTime(vault.lastHarvest)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
