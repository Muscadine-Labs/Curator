'use client';

import { useQuery } from '@tanstack/react-query';
import { getAddress, isAddress } from 'viem';
import { apiFetch } from '@/lib/data/api-fetch';
import { INDEXED_VAULT_QUERY_OPTIONS } from '@/lib/data/query-config';
import type { UserVaultPositionSummary } from '@/lib/morpho/fetch-user-vault-positions';

type ApiPosition = Omit<UserVaultPositionSummary, 'assets' | 'address'> & {
  address: string;
  assets: string;
};

function hydrate(row: ApiPosition): UserVaultPositionSummary {
  return {
    ...row,
    address: getAddress(row.address),
    assets: BigInt(row.assets),
  };
}

export function useUserVaultPositions(address: string | undefined, chainId: number) {
  return useQuery({
    queryKey: ['user-vault-positions', chainId, address?.toLowerCase() ?? null],
    queryFn: async (): Promise<UserVaultPositionSummary[]> => {
      if (!address || !isAddress(address)) return [];
      const res = await apiFetch(
        `/api/vaults/positions?address=${encodeURIComponent(address)}&chainId=${chainId}`,
        { credentials: 'omit' }
      );
      if (!res.ok) throw new Error('Failed to fetch vault positions');
      const json = (await res.json()) as { positions?: ApiPosition[] };
      return (json.positions ?? []).map(hydrate);
    },
    enabled: Boolean(address && isAddress(address) && chainId > 0),
    ...INDEXED_VAULT_QUERY_OPTIONS,
  });
}
