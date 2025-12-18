import { useQuery } from '@tanstack/react-query';

export interface SuppliedMarket {
  uniqueKey: string;
  state?: {
    utilization?: number;
    rewards?: Array<{
      supplyApr?: number;
    }>;
  };
}

export interface VaultAllocation {
  address: string;
  totalSupplyUsd: number;
  allocations: Array<{
    marketKey: string;
  }>;
}

export interface MarketsSuppliedResponse {
  markets: SuppliedMarket[];
  vaultAllocations: VaultAllocation[];
}

async function fetchMarketsSupplied(): Promise<MarketsSuppliedResponse> {
  // TODO: Implement API endpoint for markets supplied data
  // For now, return empty data to allow build to pass
  return {
    markets: [],
    vaultAllocations: [],
  };
}

export function useMarketsSupplied() {
  return useQuery<MarketsSuppliedResponse>({
    queryKey: ['markets-supplied'],
    queryFn: fetchMarketsSupplied,
    staleTime: 5 * 60 * 1000,
  });
}

