'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useVaultV2Governance } from '@/lib/hooks/useVaultV2Governance';
import { formatNumber } from '@/lib/format/number';
import type { VaultV2GovernanceResponse } from '@/app/api/vaults/v2/[id]/governance/route';

interface VaultV2CapsProps {
  vaultAddress: string;
  preloadedData?: VaultV2GovernanceResponse | null;
}

function formatRelativeCap(relativeCap: string): string {
  try {
    const scaled = BigInt(relativeCap);
    // Relative cap is scaled by 1e18; convert to %
    const percent = Number(scaled) / 1e16;
    return `${percent.toFixed(2)}%`;
  } catch {
    return relativeCap;
  }
}

function formatBigIntValue(value: string): string {
  try {
    return formatNumber(BigInt(value));
  } catch {
    return value;
  }
}

export function VaultV2Caps({ vaultAddress, preloadedData }: VaultV2CapsProps) {
  const { data: fetchedData, isLoading, error } = useVaultV2Governance(vaultAddress);
  const data = preloadedData ?? fetchedData;

  if (!preloadedData && isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Adapter Caps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Adapter Caps</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load caps: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (data.caps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Adapter Caps</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-slate-400">No caps configured.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adapter Caps</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2">
          {data.caps.map((cap, idx) => {
            const targetLabel =
              cap.adapterAddress ??
              cap.marketKey ??
              cap.collateralAddress ??
              'Global Cap';

            return (
              <div
                key={`${targetLabel}-${idx}`}
                className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 p-4 text-sm dark:border-slate-800 sm:grid-cols-5 sm:items-center"
              >
                <div>
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Type</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {cap.type}
                    </Badge>
                    <span className="text-xs text-slate-500 dark:text-slate-400 break-all">{targetLabel}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Absolute Cap</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                    {formatBigIntValue(cap.absoluteCap)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Relative Cap</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                    {formatRelativeCap(cap.relativeCap)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Allocation</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                    {formatBigIntValue(cap.allocation)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Adapter</p>
                  <p className="mt-1 break-all text-slate-700 dark:text-slate-200">
                    {cap.adapterAddress ?? 'N/A'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

