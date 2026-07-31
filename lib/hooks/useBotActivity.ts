import { useQuery } from '@tanstack/react-query';
import type { BotActivityResponse } from '@/app/api/bots/activity/route';
import { apiFetch } from '@/lib/data/api-fetch';
import { INDEXED_VAULT_QUERY_OPTIONS } from '@/lib/data/query-config';

export function useBotActivity(options?: { enabled?: boolean; limit?: number }) {
  const limit = options?.limit ?? 25;
  return useQuery({
    queryKey: ['bot-activity', 'v4', limit],
    queryFn: async (): Promise<BotActivityResponse> => {
      const params = new URLSearchParams({ limit: String(limit) });
      const res = await apiFetch(`/api/bots/activity?${params}`, {
        credentials: 'omit',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to fetch bot activity');
      }
      return res.json();
    },
    enabled: options?.enabled ?? true,
    ...INDEXED_VAULT_QUERY_OPTIONS,
  });
}
