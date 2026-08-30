'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { ArrowDownUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { CuratorEmptyText, CuratorTableShell } from '@/components/morpho/CuratorChrome';
import { useUserMarketPositions } from '@/lib/hooks/useUserMarketPositions';
import { useCuratorNetwork } from '@/lib/network/CuratorNetworkContext';
import { formatAllocationEditInputExact } from '@/lib/format/allocation-display';
import { curatorBlueMarketHref } from '@/lib/morpho/morpho-app-links';

export function WalletMarketPositionsCard() {
  const { chainId, networkName } = useCuratorNetwork();
  const { address, isConnected } = useAccount();
  const { data: positions = [], isLoading } = useUserMarketPositions(address, chainId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>Your positions</span>
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link href="/markets/positions">
              <ArrowDownUp className="mr-1.5 h-3.5 w-3.5" />
              Supply / borrow
            </Link>
          </Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Supply, borrow, and collateral for this wallet on {networkName}. Deposit
          and withdraw from Positions.
        </p>
      </CardHeader>
      <CardContent>
        {!isConnected ? (
          <div className="flex flex-wrap items-center gap-3">
            <CuratorEmptyText>Connect a wallet to see positions.</CuratorEmptyText>
            <ConnectWalletButton />
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : positions.length === 0 ? (
          <CuratorEmptyText>No Blue supply or borrow on this network.</CuratorEmptyText>
        ) : (
          <CuratorTableShell>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market</TableHead>
                  <TableHead>LLTV</TableHead>
                  <TableHead className="text-right">Supply</TableHead>
                  <TableHead className="text-right">Borrow</TableHead>
                  <TableHead className="text-right">Collateral</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((row) => {
                  const href = `/markets/positions?market=${encodeURIComponent(row.marketId)}`;
                  const marketHref = curatorBlueMarketHref(row.marketId, chainId);
                  return (
                    <TableRow key={row.marketId}>
                      <TableCell className="font-medium text-foreground">{row.pair}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {row.lltvLabel}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.supplyAssets > 0n
                          ? `${formatAllocationEditInputExact(row.supplyAssets, row.loanSymbol, row.loanDecimals, true)} ${row.loanSymbol}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.borrowAssets > 0n
                          ? `${formatAllocationEditInputExact(row.borrowAssets, row.loanSymbol, row.loanDecimals, true)} ${row.loanSymbol}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.collateral > 0n
                          ? `${formatAllocationEditInputExact(row.collateral, row.collateralSymbol, row.collateralDecimals, true)} ${row.collateralSymbol}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {marketHref ? (
                            <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                              <Link href={marketHref}>Market</Link>
                            </Button>
                          ) : null}
                          <Button asChild size="sm" variant="secondary" className="h-8 text-xs">
                            <Link href={href}>Manage</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CuratorTableShell>
        )}
      </CardContent>
    </Card>
  );
}
