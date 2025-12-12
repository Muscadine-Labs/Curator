'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Shield, Wallet, Clock } from 'lucide-react';
import { useVault } from '@/lib/hooks/useProtocolStats';
import { AppShell } from '@/components/layout/AppShell';
import { KpiCard } from '@/components/KpiCard';
import { AddressBadge } from '@/components/AddressBadge';
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

  return (
    <AppShell
      title={vault.name}
      description={`${vault.symbol} • ${vault.asset ?? ''}`}
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="default" className="flex items-center gap-1 bg-blue-600">
            <Shield className="h-3 w-3" /> V2 Prime
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
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Badge variant="secondary" className="text-xs">
            {vault.status}
          </Badge>
          <Badge variant="outline">{vault.asset}</Badge>
          <AddressBadge address={vault.address} scanUrl={vault.scanUrl} />
          <Badge variant="outline" className="flex items-center gap-1">
            <Wallet className="h-3 w-3" />
            Base
          </Badge>
        </div>

        {/* V2 Tabs: Overview, Risk Management, Roles, Adapters, Allocations, Caps, Timelock */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="risk">Risk Management</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="adapters">Adapters</TabsTrigger>
            <TabsTrigger value="allocation">Allocations</TabsTrigger>
            <TabsTrigger value="caps">Caps</TabsTrigger>
            <TabsTrigger value="timelock">Timelock</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard title="TVL" value={vault.tvl} subtitle="Total Value Locked" format="usd" />
              <KpiCard title="APY" value={vault.apy} subtitle="Current yield rate" format="percentage" />
              <KpiCard title="Depositors" value={vault.depositors} subtitle="Total depositors" format="number" />
              <KpiCard 
                title="Performance Fee" 
                value={vault.parameters?.performanceFeePercent ?? (vault.parameters?.performanceFeeBps ? vault.parameters.performanceFeeBps / 100 : null)} 
                subtitle="Curator fee rate" 
                format="percentage" 
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-500">Revenue (All Time)</p>
                  <p className="text-2xl font-semibold text-slate-900">(coming soon)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-500">Fees (All Time)</p>
                  <p className="text-2xl font-semibold text-slate-900">(coming soon)</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Risk Management Tab */}
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

          {/* Roles Tab */}
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

          {/* Adapters Tab (V2 specific) */}
          <TabsContent value="adapters" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Adapters</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center py-8 text-slate-500">Coming Soon</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Allocations Tab */}
          <TabsContent value="allocation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Allocations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center py-8 text-slate-500">Coming Soon</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Caps Tab */}
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

          {/* Timelock Tab (V2 specific) */}
          <TabsContent value="timelock" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Timelock
                </CardTitle>
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
