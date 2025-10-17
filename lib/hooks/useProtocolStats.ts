import { useQuery } from '@tanstack/react-query';

export interface ProtocolStats {
  totalDeposited: number;
  totalFeesGenerated: number;
  activeVaults: number;
  volume30d: number;
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
  apy7d: number;
  apy30d: number;
  depositors: number;
  utilization: number;
  lastHarvest: string;
}

export interface VaultDetail extends VaultWithData {
  apyBase: number;
  apyBoosted: number;
  feesYtd: number;
  charts: {
    tvl: Array<{ date: string; value: number }>;
    performance: Array<{ date: string; value: number }>;
    fees: Array<{ date: string; value: number }>;
  };
  parameters: {
    performanceFeeBps: number;
    maxDeposit: number | null;
    maxWithdrawal: number | null;
    strategyNotes: string;
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
  splitterData: {
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
      const response = await fetch('/api/mock/protocol-stats');
      if (!response.ok) throw new Error('Failed to fetch protocol stats');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
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
      
      const response = await fetch(`/api/mock/vaults?${searchParams}`);
      if (!response.ok) throw new Error('Failed to fetch vaults');
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });
};

// Vault detail hook
export const useVault = (id: string) => {
  return useQuery<VaultDetail>({
    queryKey: ['vault', id],
    queryFn: async () => {
      const response = await fetch(`/api/mock/vaults/${id}`);
      if (!response.ok) throw new Error('Failed to fetch vault');
      return response.json();
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });
};

// Fees data hook
export const useFeesData = () => {
  return useQuery<FeesData>({
    queryKey: ['fees'],
    queryFn: async () => {
      const response = await fetch('/api/mock/fees');
      if (!response.ok) throw new Error('Failed to fetch fees data');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};
