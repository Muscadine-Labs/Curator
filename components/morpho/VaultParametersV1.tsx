'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useVault } from '@/lib/hooks/useProtocolStats';
import { useVaultRoles } from '@/lib/hooks/useVaultRoles';
import { ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { publicClient } from '@/lib/onchain/client';
import type { Address } from 'viem';

interface VaultParametersV1Props {
  vaultAddress: string;
}

// Read public allocator admin and fee from contract
async function fetchPublicAllocatorParams(vaultAddress: Address) {
  try {
    
    // Try to read public allocator admin (common function names)
    const publicAllocatorAdmin = await publicClient.readContract({
      address: vaultAddress,
      abi: [
        {
          name: 'publicAllocatorAdmin',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'address' }],
        },
        {
          name: 'getPublicAllocatorAdmin',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'address' }],
        },
      ] as const,
      functionName: 'publicAllocatorAdmin',
    }).catch(() => 
      publicClient.readContract({
        address: vaultAddress,
        abi: [
          {
            name: 'getPublicAllocatorAdmin',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ name: '', type: 'address' }],
          },
        ] as const,
        functionName: 'getPublicAllocatorAdmin',
      }).catch(() => null)
    );

    // Try to read public allocator fee (in basis points)
    const publicAllocatorFeeBps = await publicClient.readContract({
      address: vaultAddress,
      abi: [
        {
          name: 'publicAllocatorFeeBps',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'uint256' }],
        },
        {
          name: 'getPublicAllocatorFeeBps',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ] as const,
      functionName: 'publicAllocatorFeeBps',
    }).catch(() => 
      publicClient.readContract({
        address: vaultAddress,
        abi: [
          {
            name: 'getPublicAllocatorFeeBps',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
          },
        ] as const,
        functionName: 'getPublicAllocatorFeeBps',
      }).catch(() => null)
    );

    return {
      publicAllocatorAdmin: publicAllocatorAdmin as Address | null,
      publicAllocatorFeeBps: publicAllocatorFeeBps ? Number(publicAllocatorFeeBps) : null,
    };
  } catch {
    return {
      publicAllocatorAdmin: null,
      publicAllocatorFeeBps: null,
    };
  }
}

// Read timelock duration from contract
async function fetchTimelockDuration(vaultAddress: Address) {
  try {
    
    const timelockDuration = await publicClient.readContract({
      address: vaultAddress,
      abi: [
        {
          name: 'timelockDuration',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'uint256' }],
        },
        {
          name: 'getTimelockDuration',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ] as const,
      functionName: 'timelockDuration',
    }).catch(() => 
      publicClient.readContract({
        address: vaultAddress,
        abi: [
          {
            name: 'getTimelockDuration',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
          },
        ] as const,
        functionName: 'getTimelockDuration',
      }).catch(() => null)
    );

    return timelockDuration ? Number(timelockDuration) : null;
  } catch {
    return null;
  }
}

export function VaultParametersV1({ vaultAddress }: VaultParametersV1Props) {
  const { data: vault, isLoading: isVaultLoading } = useVault(vaultAddress);
  const { data: roles, isLoading: isRolesLoading } = useVaultRoles(vaultAddress as Address);
  
  const { data: publicAllocatorParams, isLoading: isPublicAllocatorLoading } = useQuery({
    queryKey: ['vault-public-allocator-params', vaultAddress],
    queryFn: () => fetchPublicAllocatorParams(vaultAddress as Address),
    enabled: !!vaultAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: timelockDuration, isLoading: isTimelockLoading } = useQuery({
    queryKey: ['vault-timelock-duration', vaultAddress],
    queryFn: () => fetchTimelockDuration(vaultAddress as Address),
    enabled: !!vaultAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const isLoading = isVaultLoading || isRolesLoading || isPublicAllocatorLoading || isTimelockLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Parameters</CardTitle>
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

  if (!vault) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">Failed to load vault data</p>
        </CardContent>
      </Card>
    );
  }

  // Format timelock duration (assuming it's in seconds)
  const formatTimelockDuration = (seconds: number | null): string => {
    if (!seconds) return 'Not available';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}${hours > 0 ? ` ${hours} hour${hours !== 1 ? 's' : ''}` : ''}`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  };

  // Fee recipient is typically the curator
  const feeRecipient = roles?.curator || null;
  
  // Vault fee from state (in decimal, e.g., 0.05 = 5%)
  // performanceFeePercent is already in percent units (e.g., 5 = 5%)
  const vaultFeePercent = vault.parameters?.performanceFeePercent ??
    (vault.parameters?.performanceFeeBps ? vault.parameters.performanceFeeBps / 100 : null);

  const parameters = [
    {
      label: 'Vault Symbol',
      value: vault.symbol || 'N/A',
      type: 'text' as const,
    },
    {
      label: 'Vault Name',
      value: vault.name || 'N/A',
      type: 'text' as const,
    },
    {
      label: 'Fee Recipient',
      value: feeRecipient,
      type: 'address' as const,
    },
    {
      label: 'Public Allocator Admin',
      value: publicAllocatorParams?.publicAllocatorAdmin || null,
      type: 'address' as const,
    },
    {
      label: 'Public Allocator Fee',
      value: publicAllocatorParams?.publicAllocatorFeeBps 
        ? `${(publicAllocatorParams.publicAllocatorFeeBps / 100).toFixed(2)}%`
        : null,
      type: 'text' as const,
    },
    {
      label: 'Vault Fee',
      value: vaultFeePercent != null ? `${vaultFeePercent.toFixed(2)}%` : null,
      type: 'text' as const,
    },
    {
      label: 'Timelock Duration',
      value: formatTimelockDuration(timelockDuration ?? null),
      type: 'text' as const,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parameters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {parameters.map((param) => (
            <div key={param.label} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="text-xs uppercase tracking-wide text-slate-500">{param.label}</div>
              <div className="mt-2 flex items-center gap-2">
                {param.type === 'address' && param.value ? (
                  <>
                    <span className="font-mono text-sm">{param.value}</span>
                    <a
                      href={`https://basescan.org/address/${param.value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                ) : (
                  <span className="text-sm text-slate-900 dark:text-slate-100">
                    {param.value || 'Not available'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

