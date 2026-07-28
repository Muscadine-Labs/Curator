'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddressBadge } from '@/components/AddressBadge';
import { formatPercentage } from '@/lib/format/number';
import { resolveTokenDisplayProps } from '@/lib/format/asset-decimals';
import { formatMaxRateApr } from '@/lib/morpho/vault-v2-api';
import type { VaultDetail } from '@/lib/hooks/useProtocolStats';
import type { VaultV2GovernanceResponse } from '@/app/api/vaults/[id]/governance/route';
import { VaultOverviewHistoryChart } from '@/components/morpho/VaultOverviewHistoryChart';
import { TokenUsdValue } from '@/components/morpho/TokenUsdValue';
import { VaultV2Roles } from '@/components/morpho/VaultV2Roles';
import { VaultV2Adapters } from '@/components/morpho/VaultV2Adapters';

interface VaultOverviewPanelProps {
  vault: VaultDetail;
  morphoUiUrl: string;
  vaultName: string;
  vaultSymbol: string;
  vaultAsset: string;
  governance?: VaultV2GovernanceResponse | null;
  risk?: import('@/app/api/vaults/[id]/risk/route').V2VaultRiskResponse | null;
}

function warningBadgeClass(level: string): string {
  const l = level.toUpperCase();
  if (l === 'RED') return 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400';
  if (l === 'YELLOW') return 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-400';
  return 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400';
}

function MetricRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 sm:max-w-[45%]">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="text-sm font-semibold tabular-nums text-foreground sm:text-right">
        {children}
      </div>
    </div>
  );
}

export function VaultOverviewPanel({
  vault,
  morphoUiUrl,
  vaultName,
  vaultSymbol,
  vaultAsset,
  governance,
  risk,
}: VaultOverviewPanelProps) {
  const analytics = vault.analytics;
  const warnings = vault.warnings ?? [];
  const { chainDecimals, displayDecimals } = resolveTokenDisplayProps(
    vaultAsset,
    vault.assetDecimals
  );
  const perfFee =
    vault.parameters?.performanceFeePercent ??
    (vault.parameters?.performanceFeeBps != null
      ? vault.parameters.performanceFeeBps / 100
      : null);
  const mgmtFee = analytics?.managementFeePercent ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <a
            href={morphoUiUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xl font-semibold text-foreground hover:text-blue-600 dark:hover:text-blue-400 break-words"
          >
            {vaultName}
          </a>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-xs">
              {vaultSymbol}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {vaultAsset}
            </Badge>
            <Badge variant="secondary" className="text-xs uppercase">
              V2
            </Badge>
          </div>
        </div>
        {warnings.length > 0 && (
          <div className="flex max-w-md flex-wrap justify-end gap-1">
            {warnings.slice(0, 4).map((w, i) => (
              <Badge
                key={`${w.type}-${i}`}
                variant="outline"
                className={`text-[10px] font-normal ${warningBadgeClass(w.level)}`}
              >
                {w.type.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Vault State</h2>
          <p className="text-xs text-muted-foreground">
            Metrics, history, fees, roles, and adapters for this vault.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Metrics</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <MetricRow
              label="Total Assets"
              description="Total assets currently held in this vault"
            >
              <TokenUsdValue
                underlying={analytics?.totalAssetsUnderlying}
                usd={vault.tvl}
                assetSymbol={vaultAsset}
                chainDecimals={chainDecimals}
                displayDecimals={displayDecimals}
              />
            </MetricRow>
            <MetricRow
              label="Liquidity"
              description="Morpho's withdrawable estimate across allocations"
            >
              <TokenUsdValue
                underlying={analytics?.liquidityUnderlying}
                usd={analytics?.liquidityUsd}
                assetSymbol={vaultAsset}
                chainDecimals={chainDecimals}
                displayDecimals={displayDecimals}
              />
            </MetricRow>
            <MetricRow
              label="Idle"
              description="Cash held in the vault (not deployed to strategies)"
            >
              <TokenUsdValue
                underlying={analytics?.idleAssetsUnderlying}
                usd={analytics?.idleAssetsUsd}
                assetSymbol={vaultAsset}
                chainDecimals={chainDecimals}
                displayDecimals={displayDecimals}
              />
            </MetricRow>
            <MetricRow
              label="APY"
              description="Instant APY weighted across all allocations, including idle liquidity"
            >
              {vault.apy != null ? formatPercentage(vault.apy, 2) : '—'}
            </MetricRow>
            {analytics?.deployedPercent != null && (
              <MetricRow
                label="Deployed"
                description="Share of TVL currently allocated to strategies"
              >
                {`${analytics.deployedPercent.toFixed(1)}%`}
              </MetricRow>
            )}
          </CardContent>
        </Card>

        <VaultOverviewHistoryChart vaultAddress={vault.address} />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fees</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <MetricRow
              label="Performance Fee"
              description="Percentage of interest earned by the vault, charged on harvest"
            >
              {perfFee != null ? formatPercentage(perfFee, 2) : '0%'}
            </MetricRow>
            <MetricRow
              label="Performance Fee Recipient"
              description="Wallet address that receives the performance fee payments"
            >
              {governance?.performanceFeeRecipient ? (
                <AddressBadge address={governance.performanceFeeRecipient} truncate />
              ) : (
                '—'
              )}
            </MetricRow>
            <MetricRow
              label="Management Fee"
              description="Annual fee charged continuously on total vault assets"
            >
              {mgmtFee != null ? formatPercentage(mgmtFee, 2) : '0%'}
            </MetricRow>
            <MetricRow
              label="Management Fee Recipient"
              description="Wallet address that receives the management fee payments"
            >
              {governance?.managementFeeRecipient ? (
                <AddressBadge address={governance.managementFeeRecipient} truncate />
              ) : (
                '—'
              )}
            </MetricRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risk Parameters</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <MetricRow
              label="Max Rate"
              description="Cap how fast the vault's assets grow to avoid yield spikes"
            >
              {formatMaxRateApr(governance?.maxRate)}
            </MetricRow>
          </CardContent>
        </Card>

        <VaultV2Roles vaultAddress={vault.address} preloadedData={governance} />

        <VaultV2Adapters
          vaultAddress={vault.address}
          preloadedData={governance}
          preloadedRisk={risk}
          assetSymbol={vaultAsset}
          assetDecimals={vault.assetDecimals}
        />
      </section>
    </div>
  );
}
