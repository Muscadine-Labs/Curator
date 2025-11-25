import { useQuery } from '@tanstack/react-query';

export interface MarketReward {
  assetAddress?: string;
  chainId?: number | null;
  supplyApr: number; // percent
  borrowApr: number; // percent
}

export interface MarketHistoryPoint { date: string; value: number }

export interface SuppliedMarket {
  id: string | null; // Market contract address
  uniqueKey: string;
  lltv: number | null;
  oracleAddress: string | null;
  irmAddress: string | null;
  loanAsset: { address: string; symbol: string; decimals: number } | null;
  collateralAsset: { address: string; symbol: string; decimals: number } | null;
  state: {
    supplyAssetsUsd: number;
    borrowAssetsUsd: number;
    liquidityAssetsUsd: number;
    utilization: number;
    supplyApy: number;
    borrowApy?: number;
    rewards: MarketReward[];
  };
  history?: {
    tvl: MarketHistoryPoint[];
    supplyApy: MarketHistoryPoint[];
    borrowApy: MarketHistoryPoint[];
  };
}

export interface VaultAllocationSummary {
  address: string;
  name?: string;
  symbol?: string;
  version?: 'v1' | 'v2';
  totalSupplyUsd: number;
  allocations: Array<{ marketKey: string; supplyAssetsUsd: number; sharePct: number }>;
}

export interface MarketsSuppliedResponse {
  markets: SuppliedMarket[];
  vaultAllocations: VaultAllocationSummary[];
  availableMarkets: SuppliedMarket[];
}

export const useMarketsSupplied = () => {
  return useQuery<MarketsSuppliedResponse>({
    queryKey: ['markets-supplied'],
    queryFn: async () => {
      const res = await fetch('/api/markets-supplied');
      if (!res.ok) throw new Error('Failed to fetch markets supplied');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};


