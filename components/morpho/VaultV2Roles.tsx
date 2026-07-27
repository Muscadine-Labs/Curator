'use client';

import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressBadge } from '@/components/AddressBadge';
import { useVaultV2Governance } from '@/lib/hooks/useVaultV2Governance';
import type { VaultV2GovernanceResponse } from '@/app/api/vaults/[id]/governance/route';

interface VaultV2RolesProps {
  vaultAddress: string;
  preloadedData?: VaultV2GovernanceResponse | null;
}

function RoleRow({
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

function AddressOrDash({ address }: { address: string | null }) {
  if (!address) return <span className="font-normal text-muted-foreground">—</span>;
  return <AddressBadge address={address} truncate />;
}

function AddressList({ addresses }: { addresses: string[] }) {
  if (addresses.length === 0) {
    return <span className="font-normal text-muted-foreground">None</span>;
  }
  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      {addresses.map((addr) => (
        <AddressBadge key={addr} address={addr} truncate />
      ))}
    </div>
  );
}

export function VaultV2Roles({ vaultAddress, preloadedData }: VaultV2RolesProps) {
  const { data: fetchedData, isLoading, error } = useVaultV2Governance(vaultAddress);
  const data = preloadedData ?? fetchedData;

  if (!preloadedData && isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Roles & Permissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Roles & Permissions</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load roles: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Roles & Permissions</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <RoleRow
          label="Owner"
          description="Assigns and manages vault roles"
        >
          <AddressOrDash address={data.owner} />
        </RoleRow>
        <RoleRow
          label="Curator"
          description="Configures vault parameters and risk"
        >
          <AddressOrDash address={data.curator} />
        </RoleRow>
        <RoleRow
          label="Allocators"
          description="Authorized to rebalance allocations"
        >
          <AddressList addresses={data.allocators} />
        </RoleRow>
        <RoleRow
          label="Sentinels"
          description="Can deallocate and decrease caps"
        >
          <AddressList addresses={data.sentinels} />
        </RoleRow>
      </CardContent>
    </Card>
  );
}
