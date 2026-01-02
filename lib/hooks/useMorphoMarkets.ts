import { useQuery } from '@tanstack/react-query';
import type { MorphoMarketsResponse } from '@/lib/morpho/types';

async function fetchMorphoMarkets({ signal }: { signal?: AbortSignal }): Promise<MorphoMarketsResponse> {
  const response = await fetch('/api/morpho-markets', {
    credentials: 'omit',
    signal,
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
    queryFn: ({ signal }) => fetchMorphoMarkets({ signal }),
    staleTime: 0, // Always refetch on refresh
    refetchOnMount: true, // Refetch when component mounts
  });
}

