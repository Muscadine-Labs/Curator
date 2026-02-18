import { useQuery } from '@tanstack/react-query';
import type { V1VaultMarketRiskResponse } from '@/app/api/vaults/v1/[id]/market-risk/route';

async function fetchVaultV1MarketRisk(vaultAddress: string): Promise<V1VaultMarketRiskResponse> {
  const response = await fetch(`/api/vaults/v1/${vaultAddress}/market-risk`, {
    credentials: 'omit',
  });
  
  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    const text = await response.text();
    
    // Check if we got HTML (likely Vercel deployment protection page)
    if (contentType?.includes('text/html') || text.trim().startsWith('<!')) {
      throw new Error('Deployment protection is blocking API access. Please authenticate or use production deployment.');
    }
    
    // Try to parse as JSON for structured error messages
    try {
      const json = JSON.parse(text);
      throw new Error(json.message || json.error || 'Failed to fetch vault market risk');
    } catch {
      throw new Error(text || 'Failed to fetch vault market risk');
    }
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
  });
}
