'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useVaultRoles } from '@/lib/hooks/useVaultRoles';
import { formatAddress } from '@/lib/format/number';
import { ExternalLink } from 'lucide-react';
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
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
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

  const roleItems = [
    {
      name: 'Owner',
      address: roles.owner,
      description: 'Safe multisig with protocol ownership',
    },
    {
      name: 'Curator',
      address: roles.curator,
      description: 'Safe multisig with curator privileges',
    },
    {
      name: 'Guardian',
      address: roles.guardian,
      description: 'Safe multisig with guardian privileges',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {roleItems.map((role) => (
          <div key={role.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <Badge variant="outline">{role.name}</Badge>
                {role.address ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{formatAddress(role.address)}</span>
                    <a
                      href={`https://basescan.org/address/${role.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href={`https://app.safe.global/home?safe=base:${role.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                    >
                      Safe <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400">Not set</span>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{role.description}</p>
          </div>
        ))}

        {/* Allocators */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Allocators</Badge>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {roles.allocators.length} {roles.allocators.length === 1 ? 'allocator' : 'allocators'}
              </span>
            </div>
            {roles.allocators.length > 0 ? (
              <div className="space-y-2 pl-4">
                {roles.allocators.map((allocator, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="font-mono text-sm">{formatAddress(allocator)}</span>
                    <a
                      href={`https://basescan.org/address/${allocator}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 pl-4">No allocators</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

