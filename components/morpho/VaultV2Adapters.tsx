'use client';

import { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressBadge } from '@/components/AddressBadge';
import {
  CuratorEmptyText,
  CuratorErrorText,
  CuratorKvList,
  CuratorKvRow,
  CuratorPanel,
} from '@/components/morpho/CuratorChrome';
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
      <CuratorPanel title="Adapters">
        <div className="space-y-3 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </CuratorPanel>
    );
  }

  if (govError || !data) {
    return (
      <CuratorPanel title="Adapters">
        <div className="px-4 py-3">
          <CuratorErrorText>
            Failed to load adapters: {govError instanceof Error ? govError.message : 'Unknown error'}
          </CuratorErrorText>
        </div>
      </CuratorPanel>
    );
  }

  const idleUsd = data.idleAssetsUsd ?? 0;

  return (
    <CuratorPanel title="Adapters">
      <CuratorKvList>
        <CuratorKvRow
          label="Liquidity adapter"
          description="Adapter used for deposits and withdrawals"
        >
          {data.liquidityAdapter?.address ? (
            <AddressBadge address={data.liquidityAdapter.address} truncate />
          ) : (
            <span className="font-normal text-muted-foreground">Not set</span>
          )}
        </CuratorKvRow>

        <CuratorKvRow label="Idle" description="Unallocated vault cash">
          <span>
            {formatToken(data.idleAssets, chainDecimals, displayDecimals, assetSymbol)}
            <span className="ml-1.5 font-normal text-muted-foreground">
              ({pctOfTotal(idleUsd, totalUsd)})
            </span>
          </span>
        </CuratorKvRow>

        {adapters.map((adapter) => {
          const isLiquidity = adapter.address.toLowerCase() === liquidityAdapterAddress;
          const label = adapterLabel(adapter);
          const marketsCount =
            risk?.adapters?.find(
              (a) => a.adapterAddress.toLowerCase() === adapter.address.toLowerCase()
            )?.markets?.length ?? 0;
          const usd = adapter.assetsUsd ?? 0;

          return (
            <CuratorKvRow
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
            </CuratorKvRow>
          );
        })}
      </CuratorKvList>

      {adapters.length === 0 ? (
        <div className="px-4 py-3">
          <CuratorEmptyText>No strategy adapters enabled.</CuratorEmptyText>
        </div>
      ) : null}
    </CuratorPanel>
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
