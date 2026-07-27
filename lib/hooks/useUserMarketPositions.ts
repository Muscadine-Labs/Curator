'use client';

import { useQuery } from '@tanstack/react-query';
import { isAddress, type Hex } from 'viem';
import { apiFetch } from '@/lib/data/api-fetch';
import { INDEXED_VAULT_QUERY_OPTIONS } from '@/lib/data/query-config';
import type { UserMarketPositionSummary } from '@/lib/morpho/fetch-user-market-positions';

type ApiPosition = Omit<
  UserMarketPositionSummary,
  'supplyAssets' | 'borrowAssets' | 'collateral'
> & {
  supplyAssets: string;
  borrowAssets: string;
  collateral: string;
};

function hydrate(row: ApiPosition): UserMarketPositionSummary {
  return {
    ...row,
    marketId: row.marketId as Hex,
    supplyAssets: BigInt(row.supplyAssets),
    borrowAssets: BigInt(row.borrowAssets),
    collateral: BigInt(row.collateral),
  };
}

export function useUserMarketPositions(address: string | undefined, chainId: number) {
  return useQuery({
    queryKey: ['user-market-positions', chainId, address?.toLowerCase() ?? null],
    queryFn: async (): Promise<UserMarketPositionSummary[]> => {
      if (!address || !isAddress(address)) return [];
      const res = await apiFetch(
        `/api/markets/positions?address=${encodeURIComponent(address)}&chainId=${chainId}`,
        { credentials: 'omit' }
      );
      if (!res.ok) throw new Error('Failed to fetch market positions');
      const json = (await res.json()) as { positions?: ApiPosition[] };
      return (json.positions ?? []).map(hydrate);
    },
    enabled: Boolean(address && isAddress(address) && chainId > 0),
    ...INDEXED_VAULT_QUERY_OPTIONS,
  });
}
