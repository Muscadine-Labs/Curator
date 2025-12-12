'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Shield } from 'lucide-react';
import { useVault } from '@/lib/hooks/useProtocolStats';
import { AppShell } from '@/components/layout/AppShell';
import { KpiCard } from '@/components/KpiCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getVaultCategory } from '@/lib/config/vaults';

export default function VaultDetailPage() {
  const params = useParams();
  const vaultAddress = params.address as string;
  const { data: vault, isLoading } = useVault(vaultAddress);

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
              <Link href="/vaults">Back to vaults</Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const category = getVaultCategory(vault.name);
  const vaultVersion = category === 'v1' ? 'V1' : category === 'prime' ? 'V2 Prime' : 'V2 Vineyard';

  const morphoUiUrl = `https://app.morpho.org/base/vault/${vault.address.toLowerCase()}`;

  return (
    <AppShell
      title="Vault Details"
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Shield className="h-3 w-3" /> {vaultVersion}
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <a href={vault.scanUrl} target="_blank" rel="noreferrer">
              View on Base
            </a>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="risk">Risk Management</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
            <TabsTrigger value="allocation">Allocation</TabsTrigger>
            <TabsTrigger value="caps">Caps</TabsTrigger>
          </TabsList>

          <TabsContent value="risk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Risk Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center py-8 text-slate-500">Coming Soon</p>
              </CardContent>
            </Card>
          </TabsContent>

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
                      {vault.name}
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-sm">
                      {vault.symbol}
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      {vault.asset}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <KpiCard title="TVL" value={vault.tvl} subtitle="Total Value Locked" format="usd" />
              <KpiCard title="APY" value={vault.apy} subtitle="Current yield rate" format="percentage" />
              <KpiCard title="Depositors" value={vault.depositors} subtitle="Total depositors" format="number" />
              <KpiCard 
                title="Performance Fee" 
                value={vault.parameters?.performanceFeePercent ?? (vault.parameters?.performanceFeeBps ? vault.parameters.performanceFeeBps / 100 : null)} 
                subtitle="Curator fee rate" 
                format="percentage" 
              />
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-500 mb-1">Status</p>
                  <Badge variant={vault.status === 'active' ? 'default' : 'secondary'} className="text-sm">
                    {vault.status}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Revenue and Fees */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-500 mb-1">Revenue (All Time)</p>
                  <p className="text-2xl font-semibold text-slate-400">Coming Soon</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-500 mb-1">Fees (All Time)</p>
                  <p className="text-2xl font-semibold text-slate-400">Coming Soon</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="roles">
            <Card>
              <CardHeader>
                <CardTitle>Roles</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center py-8 text-slate-500">Coming Soon</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parameters" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Parameters</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center py-8 text-slate-500">Coming Soon</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allocation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center py-8 text-slate-500">Coming Soon</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="caps" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Caps</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center py-8 text-slate-500">Coming Soon</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
