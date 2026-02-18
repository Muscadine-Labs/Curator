'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useVault } from '@/lib/hooks/useProtocolStats';
import { ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getScanUrlForChain } from '@/lib/constants';
import { multicallRead } from '@/lib/onchain/client';
import type { Address } from 'viem';

interface VaultParametersV1Props {
  vaultAddress: string;
}

const VAULT_PARAMS_ABI = [
  { name: 'publicAllocatorAdmin', type: 'function' as const, stateMutability: 'view' as const, inputs: [] as const, outputs: [{ name: '', type: 'address' }] as const },
  { name: 'publicAllocatorFeeBps', type: 'function' as const, stateMutability: 'view' as const, inputs: [] as const, outputs: [{ name: '', type: 'uint256' }] as const },
  { name: 'timelockDuration', type: 'function' as const, stateMutability: 'view' as const, inputs: [] as const, outputs: [{ name: '', type: 'uint256' }] as const },
] as const;

/** Fetch allocator params and timelock in a single multicall (1 RPC round-trip) */
async function fetchVaultParamsOnChain(vaultAddress: Address) {
  const [publicAllocatorAdmin, publicAllocatorFeeBps, timelockDuration] = await multicallRead<Address | bigint>([
    { address: vaultAddress, abi: VAULT_PARAMS_ABI, functionName: 'publicAllocatorAdmin' },
    { address: vaultAddress, abi: VAULT_PARAMS_ABI, functionName: 'publicAllocatorFeeBps' },
    { address: vaultAddress, abi: VAULT_PARAMS_ABI, functionName: 'timelockDuration' },
  ]);

  return {
    publicAllocatorAdmin: publicAllocatorAdmin as Address | null,
    publicAllocatorFeeBps: publicAllocatorFeeBps != null ? Number(publicAllocatorFeeBps) : null,
    timelockDuration: timelockDuration != null ? Number(timelockDuration) : null,
  };
}

export function VaultParametersV1({ vaultAddress }: VaultParametersV1Props) {
  const { data: vault, isLoading: isVaultLoading } = useVault(vaultAddress);

  const { data: onChainParams, isLoading: isOnChainLoading } = useQuery({
    queryKey: ['vault-parameters-onchain', vaultAddress],
    queryFn: () => fetchVaultParamsOnChain(vaultAddress as Address),
    enabled: !!vaultAddress,
  });

  if (!vault) {
    if (isVaultLoading) {
      return (
        <Card>
          <CardHeader><CardTitle>Parameters</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader><CardTitle>Parameters</CardTitle></CardHeader>
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

  // Fee recipient (curator) and timelock from vault detail API (GraphQL)
  const feeRecipient = vault.roles?.curator ?? null;
  
  // Vault fee from state (in decimal, e.g., 0.05 = 5%)
  // performanceFeePercent is already in percent units (e.g., 5 = 5%)
  const vaultFeePercent = vault.parameters?.performanceFeePercent ??
    (vault.parameters?.performanceFeeBps ? vault.parameters.performanceFeeBps / 100 : null);

  const parameters: Array<{
    label: string;
    value: string | null | undefined;
    type: 'text' | 'address';
    isLoading?: boolean;
  }> = [
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
      value: isOnChainLoading ? undefined : (onChainParams?.publicAllocatorAdmin || null),
      type: 'address' as const,
      isLoading: isOnChainLoading,
    },
    {
      label: 'Public Allocator Fee',
      value: isOnChainLoading ? undefined : (onChainParams?.publicAllocatorFeeBps != null
        ? `${(onChainParams.publicAllocatorFeeBps / 100).toFixed(2)}%`
        : null),
      type: 'text' as const,
      isLoading: isOnChainLoading,
    },
    {
      label: 'Vault Fee',
      value: vaultFeePercent != null ? `${vaultFeePercent.toFixed(2)}%` : null,
      type: 'text' as const,
    },
    {
      label: 'Timelock Duration',
      value: (() => {
        // Prefer vault.roles.timelock when it's a number (API/GraphQL returns duration in seconds)
        const fromApi = vault.roles?.timelock;
        const seconds =
          typeof fromApi === 'number'
            ? fromApi
            : (onChainParams?.timelockDuration ?? null);
        return formatTimelockDuration(seconds);
      })(),
      type: 'text' as const,
      isLoading: typeof vault.roles?.timelock !== 'number' && isOnChainLoading,
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
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{param.label}</div>
              <div className="mt-2 flex items-center gap-2">
                {param.isLoading ? (
                  <Skeleton className="h-4 w-32" />
                ) : param.type === 'address' && param.value ? (
                  <>
                    <span className="font-mono text-sm">{param.value}</span>
                    <a
                      href={`${getScanUrlForChain(vault.chainId)}/address/${param.value}`}
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

