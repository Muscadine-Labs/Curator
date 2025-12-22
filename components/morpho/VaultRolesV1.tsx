'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressBadge } from '@/components/AddressBadge';
import { useVaultRoles } from '@/lib/hooks/useVaultRoles';
import type { Address } from 'viem';

interface VaultRolesV1Props {
  vaultAddress: Address | string;
}

export function VaultRolesV1({ vaultAddress }: VaultRolesV1Props) {
  const { data: roles, isLoading, error } = useVaultRoles(vaultAddress as Address);

  if (isLoading) {
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

  if (error || !roles) {
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

  const roleTiles = [
    { label: 'Owner', address: roles.owner },
    { label: 'Curator', address: roles.curator },
    { label: 'Guardian', address: roles.guardian },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {roleTiles.map((role) => (
            <div key={role.label} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-500">{role.label}</p>
              {role.address ? (
                <div className="mt-2">
                  <AddressBadge address={role.address} truncate={false} />
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Not set</p>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-500">Allocators</p>
            <span className="text-xs text-slate-500">
              {roles.allocators.length} {roles.allocators.length === 1 ? 'allocator' : 'allocators'}
            </span>
          </div>
          {roles.allocators.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No allocators configured</p>
          ) : (
            <div className="mt-2 space-y-2">
              {roles.allocators.map((addr) => (
                <AddressBadge key={addr} address={addr} truncate={false} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

