import { useQuery } from '@tanstack/react-query';
import type { V1VaultMarketRiskResponse } from '@/app/api/vaults/v1/[id]/market-risk/route';

async function fetchVaultV1MarketRisk(vaultAddress: string): Promise<V1VaultMarketRiskResponse> {
  const response = await fetch(`/api/vaults/v1/${vaultAddress}/market-risk`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch vault market risk' }));
    throw new Error(error.message || 'Failed to fetch vault market risk');
  }

  return response.json();
}

export function useVaultV1MarketRisk(vaultAddress: string | null | undefined) {
  return useQuery({
    queryKey: ['vault-v1-market-risk', vaultAddress],
    queryFn: () => {
      if (!vaultAddress) {
        throw new Error('Vault address is required');
      }
      return fetchVaultV1MarketRisk(vaultAddress);
    },
    enabled: !!vaultAddress,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}
