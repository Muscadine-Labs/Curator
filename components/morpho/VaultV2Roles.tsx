'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AddressBadge } from '@/components/AddressBadge';
import { useVaultV2Governance } from '@/lib/hooks/useVaultV2Governance';
import type { VaultV2GovernanceResponse } from '@/app/api/vaults/v2/[id]/governance/route';

interface VaultV2RolesProps {
  vaultAddress: string;
  preloadedData?: VaultV2GovernanceResponse | null;
}

export function VaultV2Roles({ vaultAddress, preloadedData }: VaultV2RolesProps) {
  const { data: fetchedData, isLoading, error } = useVaultV2Governance(vaultAddress);
  const data = preloadedData ?? fetchedData;

  if (!preloadedData && isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load roles: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <RoleTile title="Owner" address={data.owner} />
        <RoleTile title="Curator" address={data.curator} />
        <RoleList title="Allocators" addresses={data.allocators} emptyText="No allocators configured" />
        <RoleList title="Sentinels" addresses={data.sentinels} emptyText="No sentinels configured" />
      </CardContent>
    </Card>
  );
}

function RoleTile({ title, address }: { title: string; address: string | null }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      {address ? (
        <div className="mt-2">
          <AddressBadge address={address} truncate={false} />
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Not set</p>
      )}
    </div>
  );
}

function RoleList({
  title,
  addresses,
  emptyText,
}: {
  title: string;
  addresses: string[];
  emptyText: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
        <Badge variant="outline" className="text-xs">
          {addresses.length}
        </Badge>
      </div>
      {addresses.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {addresses.map((addr) => (
            <AddressBadge key={addr} address={addr} truncate={false} />
          ))}
        </div>
      )}
    </div>
  );
}

