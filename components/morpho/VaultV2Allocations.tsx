'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AddressBadge } from '@/components/AddressBadge';
import { useVaultV2Governance } from '@/lib/hooks/useVaultV2Governance';
import { formatUSD, formatPercentage } from '@/lib/format/number';
import type { VaultV2GovernanceResponse } from '@/app/api/vaults/v2/[id]/governance/route';

interface VaultV2AllocationsProps {
  vaultAddress: string;
  preloadedData?: VaultV2GovernanceResponse | null;
}

export function VaultV2Allocations({ vaultAddress, preloadedData }: VaultV2AllocationsProps) {
  const { data: fetchedData, isLoading, error } = useVaultV2Governance(vaultAddress);
  const data = preloadedData ?? fetchedData;

  const liquidityAdapterAddress = data?.liquidityAdapter?.address?.toLowerCase() ?? null;

  const { adapters, total } = useMemo(() => {
    if (!data?.adapters) return { adapters: [], total: 0 };

    const totalUsd = data.adapters.reduce((sum, adapter) => sum + (adapter.assetsUsd ?? 0), 0);
    const sorted = [...data.adapters].sort((a, b) => (b.assetsUsd ?? 0) - (a.assetsUsd ?? 0));

    return { adapters: sorted, total: totalUsd };
  }, [data?.adapters]);

  if (!preloadedData && isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Allocations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Allocations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load allocations: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (adapters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Allocations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">No allocations yet.</p>
        </CardContent>
      </Card>
    );
  }

  const totalLabel = total > 0 ? formatUSD(total, 2) : 'N/A';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocations</CardTitle>
        <p className="text-sm text-slate-500">Total allocated: {totalLabel}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {adapters.map((adapter) => {
          const weight = total > 0 ? ((adapter.assetsUsd ?? 0) / total) * 100 : 0;
          const isLiquidity = adapter.address.toLowerCase() === liquidityAdapterAddress;
          const label =
            adapter.metaMorpho?.name ??
            adapter.metaMorpho?.symbol ??
            (adapter.type === 'MetaMorpho' ? 'MetaMorpho Adapter' : 'Morpho Market Adapter');

          return (
            <div
              key={adapter.address}
              className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {label}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {adapter.type}
                  </Badge>
                  {isLiquidity && (
                    <Badge className="bg-emerald-600 text-white text-xs">Liquidity Adapter</Badge>
                  )}
                </div>
                <div className="flex flex-col items-start sm:items-end">
                  <AddressBadge address={adapter.address} truncate={false} />
                  {adapter.metaMorpho?.address && (
                    <p className="text-xs text-slate-500">
                      Underlying vault: <AddressBadge address={adapter.metaMorpho.address} truncate={false} />
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {adapter.assetsUsd !== null && adapter.assetsUsd !== undefined
                      ? formatUSD(adapter.assetsUsd, 2)
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatPercentage(weight, 2)} of vault
                  </p>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-900">
                <div
                  className="h-2 rounded-full bg-blue-600 dark:bg-blue-500"
                  style={{ width: `${Math.min(Math.max(weight, 0), 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

