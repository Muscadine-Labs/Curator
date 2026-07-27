'use client';

import { useMemo, type ReactNode } from 'react';
import { Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressBadge } from '@/components/AddressBadge';
import { useVaultV2Governance } from '@/lib/hooks/useVaultV2Governance';
import { useVaultV2Risk } from '@/lib/hooks/useVaultV2Risk';
import { formatRawTokenAmount, formatUSD } from '@/lib/format/number';
import {
  getTokenDisplayDecimals,
  resolveAssetDecimals,
} from '@/lib/format/asset-decimals';
import { formatForceDeallocatePenaltyWad } from '@/lib/morpho/vault-v2-api';
import type { AdapterInfo, VaultV2GovernanceResponse } from '@/app/api/vaults/[id]/governance/route';
import type { V2VaultRiskResponse } from '@/app/api/vaults/[id]/risk/route';

interface VaultV2AdaptersProps {
  vaultAddress: string;
  preloadedData?: VaultV2GovernanceResponse | null;
  preloadedRisk?: V2VaultRiskResponse | null;
  assetSymbol?: string | null;
  assetDecimals?: number | null;
}

function AdapterRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 sm:max-w-[45%]">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
        )}
      </div>
      <div className="text-sm font-semibold tabular-nums text-foreground sm:text-right">
        {children}
      </div>
    </div>
  );
}

export function VaultV2Adapters({
  vaultAddress,
  preloadedData,
  preloadedRisk,
  assetSymbol,
  assetDecimals,
}: VaultV2AdaptersProps) {
  const { data: fetchedGov, isLoading: govLoading, error: govError } = useVaultV2Governance(vaultAddress);
  const { data: fetchedRisk, isLoading: riskLoading } = useVaultV2Risk(vaultAddress, {
    initialData: preloadedRisk ?? undefined,
  });
  const data = fetchedGov ?? preloadedData;
  const risk = fetchedRisk ?? preloadedRisk;

  const liquidityAdapterAddress = data?.liquidityAdapter?.address?.toLowerCase();

  const adapters = useMemo<AdapterInfo[]>(() => {
    if (!data?.adapters) return [];
    return [...data.adapters]
      .filter((a) => !a.type.includes('MetaMorpho'))
      .sort((a, b) => (b.assetsUsd ?? 0) - (a.assetsUsd ?? 0));
  }, [data?.adapters]);

  const totalUsd = useMemo(() => {
    const idle = data?.idleAssetsUsd ?? 0;
    const strat = adapters.reduce((s, a) => s + (a.assetsUsd ?? 0), 0);
    return idle + strat;
  }, [data?.idleAssetsUsd, adapters]);

  const chainDecimals = resolveAssetDecimals(assetSymbol ?? undefined, assetDecimals ?? undefined);
  const displayDecimals = getTokenDisplayDecimals(assetSymbol ?? undefined, chainDecimals);

  if ((!preloadedData && govLoading) || (!preloadedRisk && riskLoading)) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Adapters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (govError || !data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Adapters</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load adapters: {govError instanceof Error ? govError.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const idleUsd = data.idleAssetsUsd ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Adapters</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <AdapterRow
          label="Liquidity Adapter"
          description="Adapter used for deposits and withdrawals"
        >
          {data.liquidityAdapter?.address ? (
            <AddressBadge address={data.liquidityAdapter.address} truncate />
          ) : (
            <span className="font-normal text-muted-foreground">Not set</span>
          )}
        </AdapterRow>

        <AdapterRow
          label="Idle"
          description="Unallocated vault cash"
        >
          <span>
            {formatToken(data.idleAssets, chainDecimals, displayDecimals, assetSymbol)}
            <span className="ml-1.5 font-normal text-muted-foreground">
              ({pctOfTotal(idleUsd, totalUsd)})
            </span>
          </span>
        </AdapterRow>

        {adapters.map((adapter) => {
          const isLiquidity = adapter.address.toLowerCase() === liquidityAdapterAddress;
          const label = adapterLabel(adapter);
          const marketsCount =
            risk?.adapters?.find(
              (a) => a.adapterAddress.toLowerCase() === adapter.address.toLowerCase()
            )?.markets?.length ?? 0;
          const usd = adapter.assetsUsd ?? 0;

          return (
            <AdapterRow
              key={adapter.address}
              label={label}
              description={
                <div className="flex flex-col gap-1">
                  <AddressBadge address={adapter.address} truncate />
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isLiquidity && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-emerald-500/40 text-[10px] font-normal text-emerald-700 dark:text-emerald-400"
                      >
                        <Zap className="h-2.5 w-2.5" />
                        Liquidity
                      </Badge>
                    )}
                    {marketsCount > 0 && (
                      <span>
                        {marketsCount} market{marketsCount === 1 ? '' : 's'}
                      </span>
                    )}
                    <span>
                      Penalty {formatForceDeallocatePenaltyWad(adapter.forceDeallocatePenalty)}
                    </span>
                  </div>
                </div>
              }
            >
              <span>
                {formatTokenFromAssets(adapter.assets, chainDecimals, displayDecimals, assetSymbol)}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  ({pctOfTotal(usd, totalUsd)} · {formatUSD(usd, 2)})
                </span>
              </span>
            </AdapterRow>
          );
        })}

        {adapters.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">No strategy adapters enabled.</p>
        )}
      </CardContent>
    </Card>
  );
}

function adapterLabel(adapter: AdapterInfo): string {
  return (
    adapter.metaMorpho?.name ??
    adapter.metaMorpho?.symbol ??
    (adapter.type === 'MetaMorpho' || adapter.type === 'MetaMorphoAdapter'
      ? 'MetaMorpho Adapter'
      : 'Variable Rate Market Adapter')
  );
}

function pctOfTotal(amountUsd: number, totalUsd: number): string {
  if (totalUsd <= 0) return '0%';
  return `${((amountUsd / totalUsd) * 100).toFixed(1)}%`;
}

function formatToken(
  raw: string | null,
  decimals: number,
  displayDecimals: number,
  symbol?: string | null
): string {
  if (!raw) return symbol ? `0 ${symbol}` : '0';
  try {
    const f = formatRawTokenAmount(BigInt(raw), decimals, displayDecimals);
    return symbol ? `${f} ${symbol}` : f;
  } catch {
    return '—';
  }
}

function formatTokenFromAssets(
  assets: number | null,
  decimals: number,
  displayDecimals: number,
  symbol?: string | null
): string {
  if (assets == null) return '—';
  try {
    const f = formatRawTokenAmount(BigInt(Math.floor(assets)), decimals, displayDecimals);
    return symbol ? `${f} ${symbol}` : f;
  } catch {
    return '—';
  }
}
