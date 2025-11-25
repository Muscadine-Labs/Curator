import { useQuery } from '@tanstack/react-query';
import { QUERY_STALE_TIME_MEDIUM, QUERY_STALE_TIME_SHORT, QUERY_REFETCH_INTERVAL_MEDIUM, QUERY_REFETCH_INTERVAL_SHORT } from '@/lib/constants';

export interface ProtocolStats {
  totalDeposited: number;
  totalFeesGenerated: number;
  activeVaults: number;
  totalInterestGenerated: number;
  users: number;
  tvlTrend: Array<{ date: string; value: number }>;
  feesTrend: Array<{ date: string; value: number }>;
}

export interface VaultWithData {
  id: string;
  name: string;
  symbol: string;
  asset: string;
  address: string;
  chainId: number;
  scanUrl: string;
  performanceFeeBps: number;
  status: 'active' | 'paused' | 'deprecated';
  riskTier: 'low' | 'medium' | 'high';
  createdAt: string;
  description?: string;
  tvl: number;
  tokenAmount: string | null;
  assetDecimals: number;
  apy7d: number;
  apy30d: number;
  depositors: number;
  utilization: number;
  lastHarvest: string | null;
}

export interface VaultDetail extends VaultWithData {
  apyBase: number | null;
  apyBoosted: number | null;
  feesYtd: number | null;
  // charts: removed - always null, historical data not available via current Morpho API
  apyBreakdown?: {
    apy: number | null;
    netApy: number | null;
    netApyWithoutRewards: number | null;
    avgApy: number | null;
    avgNetApy: number | null;
    dailyApy: number | null;
    dailyNetApy: number | null;
    weeklyApy: number | null;
    weeklyNetApy: number | null;
    monthlyApy: number | null;
    monthlyNetApy: number | null;
    underlyingYieldApr: number | null;
  };
  rewards?: Array<{
    assetAddress: string;
    supplyApr: number;
    yearlySupplyTokens: number;
    chainId?: number | null;
  }>;
  allocation?: Array<{
    marketKey: string;
    loanAssetName?: string | null;
    collateralAssetName?: string | null;
    oracleAddress?: string | null;
    irmAddress?: string | null;
    lltv?: number | null;
    supplyCap?: number | null;
    supplyAssets?: number | null;
    supplyAssetsUsd?: number | null;
    marketRewards?: Array<{
      assetAddress: string;
      chainId?: number | null;
      supplyApr: number;
      borrowApr?: number | null;
    }>;
  }>;
  queues?: {
    supplyQueueIndex: number | null;
    withdrawQueueIndex: number | null;
  };
  warnings?: Array<{ type: string; level: 'YELLOW' | 'RED' }>;
  metadata?: {
    description?: string | null;
    image?: string | null;
    forumLink?: string | null;
    curators?: Array<{ image?: string | null; name?: string | null; url?: string | null }>;
  };
  roles?: {
    owner?: string | null;
    curator?: string | null;
    guardian?: string | null;
    timelock?: string | null;
  };
  transactions?: Array<{
    blockNumber: number;
    hash: string;
    type: string;
    userAddress?: string | null;
  }>;
  parameters: {
    performanceFeeBps: number;
    maxDeposit: number | null;
    maxWithdrawal: number | null;
    strategyNotes: string;
  };
  historicalData?: {
    apy?: Array<{ x: number; y: number }>;
    netApy?: Array<{ x: number; y: number }>;
    totalAssets?: Array<{ x: number; y: number }>;
    totalAssetsUsd?: Array<{ x: number; y: number }>;
  };
}

export interface FeesData {
  totalFeesGenerated: number;
  performanceFeeBps: number;
  feeHistory: Array<{
    date: string;
    amount: number;
    token: string;
    vault: string;
  }>;
  feesTrend?: Array<{
    date: string;
    value: number;
  }>;
  splitterData?: {
    payee1: string;
    payee2: string;
    shares1: bigint;
    shares2: bigint;
    totalShares: bigint;
  };
}

// Protocol stats hook
export const useProtocolStats = () => {
  return useQuery<ProtocolStats>({
    queryKey: ['protocol-stats'],
    queryFn: async () => {
      const response = await fetch('/api/protocol-stats');
      if (!response.ok) throw new Error('Failed to fetch protocol stats');
      return response.json();
    },
    staleTime: QUERY_STALE_TIME_MEDIUM,
    refetchInterval: QUERY_REFETCH_INTERVAL_MEDIUM,
  });
};

// Vault list hook
export const useVaultList = (filters?: {
  asset?: string;
  status?: string;
  riskTier?: string;
  search?: string;
}) => {
  return useQuery<VaultWithData[]>({
    queryKey: ['vaults', filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (filters?.asset) searchParams.set('asset', filters.asset);
      if (filters?.status) searchParams.set('status', filters.status);
      if (filters?.riskTier) searchParams.set('riskTier', filters.riskTier);
      if (filters?.search) searchParams.set('search', filters.search);
      
      const response = await fetch(`/api/vaults?${searchParams}`);
      if (!response.ok) throw new Error('Failed to fetch vaults');
      return response.json();
    },
    staleTime: QUERY_STALE_TIME_SHORT,
    refetchInterval: QUERY_REFETCH_INTERVAL_SHORT,
  });
};

// Vault detail hook
export const useVault = (id: string) => {
  return useQuery<VaultDetail>({
    queryKey: ['vault', id],
    queryFn: async () => {
      const response = await fetch(`/api/vaults/${id}`);
      if (!response.ok) throw new Error('Failed to fetch vault');
      return response.json();
    },
    enabled: !!id,
    staleTime: QUERY_STALE_TIME_SHORT,
    refetchInterval: QUERY_REFETCH_INTERVAL_SHORT,
  });
};

// Fees data hook
export const useFeesData = () => {
  return useQuery<FeesData>({
    queryKey: ['fees'],
    queryFn: async () => {
      const response = await fetch('/api/dune/fees');
      if (!response.ok) {
        // Don't fall back to mock data - return empty data structure instead
        // This ensures we show real data or nothing, not hardcoded mock values
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch fees data from Dune API');
      }
      return response.json();
    },
    staleTime: QUERY_STALE_TIME_MEDIUM,
    refetchInterval: QUERY_REFETCH_INTERVAL_MEDIUM,
    retry: 1,
  });
};
