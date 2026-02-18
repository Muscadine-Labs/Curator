import { useQuery } from '@tanstack/react-query';
import type { MorphoMarketsResponse } from '@/lib/morpho/types';

async function fetchMorphoMarkets(): Promise<MorphoMarketsResponse> {
  const response = await fetch('/api/morpho-markets', {
    credentials: 'omit',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to fetch Morpho markets');
  }

  return response.json();
}

export function useMorphoMarkets() {
  return useQuery({
    queryKey: ['morpho-markets'],
    queryFn: fetchMorphoMarkets,
  });
}

