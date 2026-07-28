'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getVaultCategory } from '@/lib/config/vaults';
import {
  useVaultList,
  SIDEBAR_VAULT_LIST_FILTERS,
  type VaultWithData,
} from '@/lib/hooks/useProtocolStats';
import { formatPercentage } from '@/lib/format/number';
import {
  resolveTokenDisplayProps,
} from '@/lib/format/asset-decimals';
import { TokenUsdValue } from '@/components/morpho/TokenUsdValue';
import { SIDEBAR_NETWORKS } from '@/lib/constants';

const CATEGORY_ORDER = ['prime', 'frontier', 'vineyard', 'test'] as const;

const CATEGORY_LABEL: Record<(typeof CATEGORY_ORDER)[number], string> = {
  prime: 'Prime',
  frontier: 'Frontier',
  vineyard: 'Vineyard',
  test: 'Test',
};

function VaultListTvl({ vault }: { vault: VaultWithData }) {
  const assetSymbol = vault.asset ?? 'UNKNOWN';
  const { chainDecimals, displayDecimals } = resolveTokenDisplayProps(
    assetSymbol,
    vault.assetDecimals
  );
  return (
    <div className="mb-0.5">
      <TokenUsdValue
        underlying={vault.totalAssetsUnderlying}
        usd={vault.tvl}
        assetSymbol={assetSymbol}
        chainDecimals={chainDecimals}
        displayDecimals={displayDecimals}
        align="right"
      />
    </div>
  );
}

function categoryOf(vault: VaultWithData): (typeof CATEGORY_ORDER)[number] {
  if (
    vault.listCategory === 'prime' ||
    vault.listCategory === 'frontier' ||
    vault.listCategory === 'vineyard' ||
    vault.listCategory === 'test'
  ) {
    return vault.listCategory;
  }
  const cat = getVaultCategory(vault.name, vault.address);
  if (cat === 'frontier' || cat === 'vineyard') return cat;
  return 'prime';
}

export default function VaultsCatalogPage() {
  const { data: vaults = [], isLoading } = useVaultList(SIDEBAR_VAULT_LIST_FILTERS);

  const byNetwork = useMemo(
    () =>
      SIDEBAR_NETWORKS.map((network) => {
        const list = vaults.filter((v) => v.chainId === network.chainId);
        const groups = CATEGORY_ORDER.map((type) => ({
          type,
          label: CATEGORY_LABEL[type],
          vaults: list.filter((v) => categoryOf(v) === type),
        })).filter((g) => g.vaults.length > 0);
        return { network, groups };
      }).filter((n) => n.groups.length > 0),
    [vaults]
  );

  return (
    <AppShell
      title="Vaults"
      description="Managed Morpho Vault V2 catalog — open a vault for curator ops, or Transact to deposit/withdraw."
      actions={
        <Link
          href="/vaults/transact"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted/50"
        >
          Transact
        </Link>
      }
    >
      <div className="mx-auto w-full max-w-4xl space-y-8">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          byNetwork.map(({ network, groups }) => (
            <section key={network.chainId} className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{network.name}</h2>
                <p className="text-xs text-muted-foreground">
                  Curator vault ops · deposit/withdraw via Transact
                </p>
              </div>
              {groups.map((group) => (
                <div key={group.type} className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  <Card className="border-border/70">
                    <CardContent className="divide-y divide-border/60 p-0">
                      {group.vaults.map((vault) => (
                        <Link
                          key={vault.address}
                          href={`/vault/${vault.address}`}
                          className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                        >
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                              {vault.name ?? 'Unknown Vault'}
                              {vault.asset ? (
                                <Badge variant="outline" className="text-[10px] font-normal">
                                  {vault.asset}
                                </Badge>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                              {vault.address.slice(0, 10)}…{vault.address.slice(-6)}
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                            <VaultListTvl vault={vault} />
                            {vault.apy != null ? formatPercentage(vault.apy, 2) : '—'} APY
                          </span>
                        </Link>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}
