'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Shield } from 'lucide-react';
import { useVault } from '@/lib/hooks/useProtocolStats';
import { getVaultCategory } from '@/lib/config/vaults';
import { AppShell } from '@/components/layout/AppShell';
import { KpiCard } from '@/components/KpiCard';
import { VaultRiskV2 } from '@/components/morpho/VaultRiskV2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function V2VaultPage() {
  const params = useParams();
  const address = params.address as string;
  const { data: vault, isLoading } = useVault(address);

  if (isLoading) {
    return (
      <AppShell title="Loading vault..." description="Fetching vault data">
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="h-24 rounded-xl bg-slate-100" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (!vault) {
    return (
      <AppShell title="Vault not found" description="The vault you're looking for doesn't exist.">
        <Card>
          <CardHeader>
            <CardTitle>Missing vault</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Check the address or pick a vault from the sidebar.</p>
            <Button asChild>
              <Link href="/">Back to overview</Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const category = getVaultCategory(vault.name);
  const vaultBadge = category === 'prime' ? 'V2 Prime' : category === 'vineyard' ? 'V2 Vineyard' : 'V2';

  const morphoUiUrl = vault.address 
    ? `https://app.morpho.org/base/vault/${vault.address.toLowerCase()}`
    : '#';
  
  // Safe defaults for missing data
  const vaultName = vault.name ?? 'Unknown Vault';
  const vaultSymbol = vault.symbol ?? 'UNKNOWN';
  const vaultAsset = vault.asset ?? 'UNKNOWN';

  return (
    <AppShell
      title="Vault Details"
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="default" className="flex items-center gap-1 bg-blue-600">
            <Shield className="h-3 w-3" /> {vaultBadge}
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <a href={vault.address ? `https://basescan.org/address/${vault.address}` : '#'} target="_blank" rel="noreferrer">
              View on Basescan
            </a>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* V2 Tabs: Overview, Risk Management */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="risk">Risk Management</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Header: Name, Ticker, Asset */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3">
                  <div>
                    <a
                      href={morphoUiUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-2xl font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                    >
                      {vaultName}
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-sm">
                      {vaultSymbol}
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      {vaultAsset}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <KpiCard title="TVL" value={vault.tvl} subtitle="Total Value Locked" format="usd" />
              <KpiCard title="APY" value={vault.apy} subtitle="Current yield rate" format="percentage" />
              <KpiCard title="Depositors" value={vault.depositors} subtitle="Total depositors" format="number" />
              <KpiCard 
                title="Performance Fee" 
                value={vault.parameters?.performanceFeePercent ?? (vault.parameters?.performanceFeeBps ? vault.parameters.performanceFeeBps / 100 : null)} 
                subtitle="Curator fee rate" 
                format="percentage" 
              />
              <KpiCard title="Revenue (All Time)" value="Coming Soon" subtitle="Total revenue generated" format="raw" />
              <KpiCard title="Fees (All Time)" value="Coming Soon" subtitle="Total fees collected" format="raw" />
            </div>
          </TabsContent>

          {/* Risk Management Tab */}
          <TabsContent value="risk" className="space-y-4">
            <VaultRiskV2 vaultAddress={vault.address} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
