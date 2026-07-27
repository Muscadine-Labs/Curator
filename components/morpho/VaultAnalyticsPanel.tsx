'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatFullUSD, formatRawTokenAmount } from '@/lib/format/number';
import {
  getTokenDisplayDecimals,
  resolveAssetDecimals,
} from '@/lib/format/asset-decimals';
import type { VaultDetail } from '@/lib/hooks/useProtocolStats';
import { VaultOverviewHistoryChart } from '@/components/morpho/VaultOverviewHistoryChart';
import { VaultRiskV2 } from '@/components/morpho/VaultRiskV2';
import { VaultHolders } from '@/components/morpho/VaultHolders';
import { VaultTransactions } from '@/components/morpho/VaultTransactions';

interface VaultAnalyticsPanelProps {
  vault: VaultDetail;
  risk?: import('@/app/api/vaults/[id]/risk/route').V2VaultRiskResponse | null;
}

function LiquidityBreakdownCell({
  label,
  usd,
  underlying,
  assetSymbol,
  chainDecimals,
  displayDecimals,
  usdClassName,
}: {
  label: string;
  usd: number | null | undefined;
  underlying: string | null | undefined;
  assetSymbol: string;
  chainDecimals: number;
  displayDecimals: number;
  usdClassName?: string;
}) {
  let nativeLine: string | null = null;
  if (underlying != null) {
    try {
      nativeLine = `${formatRawTokenAmount(BigInt(underlying), chainDecimals, displayDecimals)} ${assetSymbol}`;
    } catch {
      nativeLine = null;
    }
  }

  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${usdClassName ?? ''}`}>
        {usd != null ? formatFullUSD(usd, 2) : '—'}
      </p>
      {nativeLine && (
        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{nativeLine}</p>
      )}
    </div>
  );
}

export function VaultAnalyticsPanel({ vault, risk }: VaultAnalyticsPanelProps) {
  const analytics = vault.analytics;
  const vaultAsset = vault.asset ?? 'UNKNOWN';
  const chainDecimals = resolveAssetDecimals(vaultAsset, vault.assetDecimals);
  const displayDecimals = getTokenDisplayDecimals(vaultAsset, chainDecimals);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Analytics & Risk</h2>
        <p className="text-xs text-muted-foreground">
          Liquidity, history, market risk grades, holders, and recent activity.
        </p>
      </div>

      {vault.tvl != null && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Liquidity breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-4 sm:grid-cols-3">
              <LiquidityBreakdownCell
                label="Total TVL"
                usd={vault.tvl}
                underlying={analytics?.totalAssetsUnderlying}
                assetSymbol={vaultAsset}
                chainDecimals={chainDecimals}
                displayDecimals={displayDecimals}
              />
              <LiquidityBreakdownCell
                label="Liquidity"
                usd={analytics?.liquidityUsd}
                underlying={analytics?.liquidityUnderlying}
                assetSymbol={vaultAsset}
                chainDecimals={chainDecimals}
                displayDecimals={displayDecimals}
                usdClassName="text-emerald-700 dark:text-emerald-400"
              />
              <LiquidityBreakdownCell
                label="Idle (vault)"
                usd={analytics?.idleAssetsUsd}
                underlying={analytics?.idleAssetsUnderlying}
                assetSymbol={vaultAsset}
                chainDecimals={chainDecimals}
                displayDecimals={displayDecimals}
              />
            </div>
            {analytics?.deployedPercent != null && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                ~{analytics.deployedPercent.toFixed(1)}% of TVL is deployed to strategies.
                Liquidity is Morpho&apos;s withdrawable estimate; idle is cash held in the vault.
              </p>
            )}
            {analytics?.capUtilizationPercent != null && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Cap utilization ~{analytics.capUtilizationPercent.toFixed(1)}%.
                {analytics.managementFeePercent != null &&
                  ` Management fee ${analytics.managementFeePercent.toFixed(2)}%.`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <VaultOverviewHistoryChart vaultAddress={vault.address} />

      <VaultRiskV2
        vaultAddress={vault.address}
        chainId={vault.chainId}
        preloadedData={risk}
      />

      <VaultHolders
        vaultAddress={vault.address}
        chainId={vault.chainId}
        assetDecimals={vault.assetDecimals}
        assetSymbol={vault.asset}
      />

      <VaultTransactions
        vaultAddress={vault.address}
        chainId={vault.chainId}
        assetDecimals={vault.assetDecimals}
        assetSymbol={vault.asset}
      />
    </div>
  );
}
