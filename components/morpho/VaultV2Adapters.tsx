'use client';

import { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressBadge } from '@/components/AddressBadge';
import { useVaultV2Governance } from '@/lib/hooks/useVaultV2Governance';
import { formatUSD, formatNumber } from '@/lib/format/number';
import type { VaultV2GovernanceResponse } from '@/app/api/vaults/v2/[id]/governance/route';

interface VaultV2AdaptersProps {
  vaultAddress: string;
  preloadedData?: VaultV2GovernanceResponse | null;
}

export function VaultV2Adapters({ vaultAddress, preloadedData }: VaultV2AdaptersProps) {
  const { data: fetchedData, isLoading, error } = useVaultV2Governance(vaultAddress);
  const data = preloadedData ?? fetchedData;

  const liquidityAdapterAddress = data?.liquidityAdapter?.address?.toLowerCase();

  const adapters = useMemo(() => {
    if (!data?.adapters) return [];
    return [...data.adapters].sort((a, b) => (b.assetsUsd ?? 0) - (a.assetsUsd ?? 0));
  }, [data?.adapters]);

  if (!preloadedData && isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Adapters</CardTitle>
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
          <CardTitle>Adapters</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load adapters: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (adapters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Adapters</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-slate-400">No adapters configured for this vault.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adapters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {adapters.map((adapter) => {
          const label =
            adapter.metaMorpho?.name ??
            adapter.metaMorpho?.symbol ??
            (adapter.type === 'MetaMorpho' ? 'MetaMorpho Adapter' : 'Morpho Market Adapter');

          const isLiquidity = adapter.address.toLowerCase() === liquidityAdapterAddress;

          return (
            <div
              key={adapter.address}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {label}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {adapter.type === 'MetaMorpho' ? 'Vault Adapter' : 'Market Adapter'}
                    </Badge>
                    {isLiquidity && (
                      <Badge className="flex items-center gap-1 bg-emerald-600 text-white">
                        <Zap className="h-3 w-3" />
                        Liquidity Adapter
                      </Badge>
                    )}
                  </div>
                  <AddressBadge address={adapter.address} truncate={false} />
                  {adapter.metaMorpho?.address && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Underlying vault: <AddressBadge address={adapter.metaMorpho.address} truncate={false} />
                    </p>
                  )}
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Allocated</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {adapter.assetsUsd !== null && adapter.assetsUsd !== undefined
                      ? formatUSD(adapter.assetsUsd, 2)
                      : 'N/A'}
                  </p>
                  {adapter.assets !== null && adapter.assets !== undefined && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Raw: {formatNumber(adapter.assets)} units
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

