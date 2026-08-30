'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CapLabel } from '@/components/morpho/CapLabel';
import { CapUtilizationRing } from '@/components/morpho/CapUtilizationRing';
import { useVaultV2Governance } from '@/lib/hooks/useVaultV2Governance';
import { useVaultV2Risk } from '@/lib/hooks/useVaultV2Risk';
import {
  buildAdapterLabelMap,
  capDisplayLabel,
  capLltvPill,
  capRowKey,
  formatCapCompactAmount,
  formatCapRelative,
  groupCaps,
  sortCapsByAllocationDesc,
  absoluteCapUtilizationPercent,
  relativeCapUtilizationPercent,
} from '@/lib/morpho/v2-cap-format';
import { formatForceDeallocatePenaltyWad, formatMaxRateApr } from '@/lib/morpho/vault-v2-api';
import { publicAllocatorMarketLookupKey } from '@/lib/morpho/v2-public-allocator-key';
import type { CapInfo, VaultV2GovernanceResponse } from '@/app/api/vaults/[id]/governance/route';
import type { V2VaultRiskResponse } from '@/app/api/vaults/[id]/risk/route';
import type { VaultV2PendingResponse } from '@/app/api/vaults/[id]/pending/route';
import { VaultV2Pending } from '@/components/morpho/VaultV2Pending';
import { cn } from '@/lib/utils';

interface VaultV2CapsProps {
  vaultAddress: string;
  chainId: number;
  preloadedData?: VaultV2GovernanceResponse | null;
  preloadedRisk?: V2VaultRiskResponse | null;
  preloadedPending?: VaultV2PendingResponse | null;
  assetSymbol?: string | null;
  assetDecimals?: number | null;
  totalAssetsUnderlying?: string | null;
}

type CapsView = 'vault' | 'publicAllocator';

export function VaultV2Caps({
  vaultAddress,
  chainId,
  preloadedData,
  preloadedRisk,
  preloadedPending,
  assetSymbol,
  assetDecimals,
  totalAssetsUnderlying,
}: VaultV2CapsProps) {
  const { data: fetchedGov, isLoading: govLoading, error: govError } = useVaultV2Governance(vaultAddress);
  const { data: fetchedRisk } = useVaultV2Risk(vaultAddress, {
    initialData: preloadedRisk ?? undefined,
  });
  const data = fetchedGov ?? preloadedData;
  const risk = preloadedRisk ?? fetchedRisk;
  const [view, setView] = useState<CapsView>('vault');

  if (!preloadedData && govLoading) {
    return <CapsSkeleton />;
  }

  if (govError || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Caps</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load caps: {govError instanceof Error ? govError.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const publicAllocator = data.publicAllocator;
  const hasPublicAllocator = publicAllocator != null;
  const adapterLabels = buildAdapterLabelMap(data.adapters);
  const grouped = groupCaps(data.caps);
  const pendingCount = preloadedPending?.pending?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Caps</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {view === 'publicAllocator'
            ? 'Cap the total allocation each market can hold after a Public Allocator move, and choose which markets it can deallocate from.'
            : 'Supply and borrow limits for adapters, collateral tokens, and Morpho markets. Vault caps still bind Public Allocator moves.'}
          {pendingCount > 0
            ? ' Accept executable timelock actions below — any connected wallet or multisig Safe may submit after the waiting period.'
            : ''}
        </p>
      </div>

      {pendingCount > 0 ? (
        <VaultV2Pending
          vaultAddress={vaultAddress}
          chainId={chainId}
          preloadedData={preloadedPending}
          preloadedGovernance={data}
          preloadedRisk={risk}
          assetSymbol={assetSymbol}
          assetDecimals={assetDecimals}
          vaultSymbol={assetSymbol ?? undefined}
          embedded
          compactEmbedded
          allowAccept
        />
      ) : null}

      {hasPublicAllocator ? (
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
          <ViewToggle
            active={view === 'vault'}
            onClick={() => setView('vault')}
          >
            Vault
          </ViewToggle>
          <ViewToggle
            active={view === 'publicAllocator'}
            onClick={() => setView('publicAllocator')}
          >
            Public Allocator
          </ViewToggle>
        </div>
      ) : null}

      {view === 'publicAllocator' && publicAllocator ? (
        <PublicAllocatorCaps
          state={publicAllocator}
          caps={grouped.market}
          risk={risk}
          adapterLabels={adapterLabels}
          assetSymbol={assetSymbol}
          assetDecimals={assetDecimals}
          chainId={chainId}
        />
      ) : data.caps.length === 0 ? (
        <div className="space-y-4">
          <MaxRateBlock maxRate={data.maxRate} />
          <p className="text-sm text-muted-foreground">No caps configured.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <MaxRateBlock maxRate={data.maxRate} />
          {grouped.market.length > 0 ? (
            <CapTableSection
              title="Variable rate markets"
              description="Limit the amount of assets that can be allocated to specific Morpho markets."
              caps={grouped.market}
              risk={risk}
              adapterLabels={adapterLabels}
              assetSymbol={assetSymbol}
              assetDecimals={assetDecimals}
              chainId={chainId}
              totalAssetsUnderlying={totalAssetsUnderlying}
              showLltv
            />
          ) : null}
          {grouped.collateral.length > 0 ? (
            <CapTableSection
              title="Collateral tokens"
              description="Limit the amount of assets that can be allocated to positions using specific collateral tokens."
              caps={grouped.collateral}
              risk={risk}
              adapterLabels={adapterLabels}
              assetSymbol={assetSymbol}
              assetDecimals={assetDecimals}
              chainId={chainId}
              totalAssetsUnderlying={totalAssetsUnderlying}
            />
          ) : null}
          {grouped.adapter.length > 0 ? (
            <CapTableSection
              title="Adapters"
              description="Limit the amount of assets that can be allocated to positions using specific adapters."
              caps={grouped.adapter}
              risk={risk}
              adapterLabels={adapterLabels}
              assetSymbol={assetSymbol}
              assetDecimals={assetDecimals}
              chainId={chainId}
              totalAssetsUnderlying={totalAssetsUnderlying}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function CapsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Caps</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  );
}

function MaxRateBlock({ maxRate }: { maxRate: string | null }) {
  if (maxRate == null) return null;
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm font-semibold text-foreground">Max rate</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Caps how fast the vault&apos;s assets can grow to avoid yield spikes.
      </p>
      <p className="mt-2 text-lg font-semibold tabular-nums">{formatMaxRateApr(maxRate)}</p>
    </div>
  );
}

function CapTableSection({
  title,
  description,
  caps,
  risk,
  adapterLabels,
  assetSymbol,
  assetDecimals,
  chainId,
  totalAssetsUnderlying,
  showLltv,
}: {
  title: string;
  description: string;
  caps: CapInfo[];
  risk: V2VaultRiskResponse | null | undefined;
  adapterLabels: Map<string, string>;
  assetSymbol?: string | null;
  assetDecimals?: number | null;
  chainId: number;
  totalAssetsUnderlying?: string | null;
  showLltv?: boolean;
}) {
  const rows = sortCapsByAllocationDesc(caps);
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {title}{' '}
          <span className="font-normal text-muted-foreground">({rows.length})</span>
        </h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Allocation</TableHead>
              <TableHead>Absolute cap</TableHead>
              <TableHead>Relative cap</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((cap, idx) => (
              <TableRow key={capRowKey(cap, idx)}>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      <CapLabel
                        cap={cap}
                        label={capDisplayLabel(cap, risk, adapterLabels)}
                        chainId={chainId}
                      />
                    </span>
                    {showLltv ? (
                      capLltvPill(cap, risk) ? (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {capLltvPill(cap, risk)}
                        </Badge>
                      ) : null
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatCapCompactAmount(cap.allocation, assetSymbol, assetDecimals)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 tabular-nums">
                    {formatCapCompactAmount(cap.absoluteCap, assetSymbol, assetDecimals)}
                    <CapUtilizationRing
                      percent={absoluteCapUtilizationPercent(cap.allocation, cap.absoluteCap)}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 tabular-nums">
                    {formatCapRelative(cap.relativeCap)}
                    <CapUtilizationRing
                      percent={relativeCapUtilizationPercent(
                        cap.allocation,
                        cap.relativeCap,
                        totalAssetsUnderlying
                      )}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PublicAllocatorCaps({
  state,
  caps,
  risk,
  adapterLabels,
  assetSymbol,
  assetDecimals,
  chainId,
}: {
  state: NonNullable<VaultV2GovernanceResponse['publicAllocator']>;
  caps: CapInfo[];
  risk: V2VaultRiskResponse | null | undefined;
  adapterLabels: Map<string, string>;
  assetSymbol?: string | null;
  assetDecimals?: number | null;
  chainId: number;
}) {
  const paByMarket = new Map<string, (typeof state.markets)[number]>();
  for (const row of state.markets) {
    if (row.marketKey && row.adapterAddress) {
      paByMarket.set(publicAllocatorMarketLookupKey(row.adapterAddress, row.marketKey), row);
    }
  }

  const rows = sortCapsByAllocationDesc(caps);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Public Allocator caps</p>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm text-foreground">Allow allocations from idle</p>
          <AllowedBadge allowed={state.canPullFromIdle} />
        </div>
        {state.penalty != null ? (
          <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
            <p className="text-sm text-foreground">Penalty</p>
            <p className="text-sm tabular-nums text-muted-foreground">
              {formatForceDeallocatePenaltyWad(state.penalty)}
            </p>
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No market caps to show. Public Allocator target ceilings are per Morpho market.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Market</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead>Vault absolute cap</TableHead>
                <TableHead>
                  Public Allocator cap
                  {assetSymbol ? ` (${assetSymbol})` : ''}
                </TableHead>
                <TableHead>Allow deallocation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((cap, idx) => {
                const pa =
                  cap.adapterAddress && cap.marketKey
                    ? paByMarket.get(
                        publicAllocatorMarketLookupKey(cap.adapterAddress, cap.marketKey)
                      )
                    : undefined;
                const lltv = capLltvPill(cap, risk);
                return (
                  <TableRow key={capRowKey(cap, idx)}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          <CapLabel
                            cap={cap}
                            label={capDisplayLabel(cap, risk, adapterLabels)}
                            chainId={chainId}
                          />
                        </span>
                        {lltv ? (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {lltv}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCapCompactAmount(cap.allocation, assetSymbol, assetDecimals)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCapCompactAmount(cap.absoluteCap, assetSymbol, assetDecimals)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCapCompactAmount(pa?.absoluteCap, assetSymbol, assetDecimals)}
                    </TableCell>
                    <TableCell>
                      <AllowedBadge allowed={pa?.canPullFromMarket ?? null} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function AllowedBadge({ allowed }: { allowed: boolean | null }) {
  if (allowed == null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  if (allowed) {
    return (
      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Allowed</span>
    );
  }
  return <span className="text-sm text-muted-foreground">Not allowed</span>;
}
