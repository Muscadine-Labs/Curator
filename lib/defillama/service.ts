/**
 * DefiLlama API Service
 * 
 * Fetches fees and revenue data from DefiLlama for Muscadine vaults.
 * DefiLlama stores historical data automatically - no caching needed.
 * 
 * Reference: https://github.com/DefiLlama/dimension-adapters/blob/master/fees/muscadine.ts
 */

import { EXTERNAL_API_TIMEOUT_MS } from '@/lib/constants';

const DEFILLAMA_API_BASE = 'https://api.llama.fi';
const PROTOCOL_SLUG = 'muscadine';

export interface DefiLlamaFeesResponse {
  id: string;
  name: string;
  total24h: number | null;
  total7d: number | null;
  total30d: number | null;
  totalAllTime: number | null;
  totalDataChart: Array<[number, number]> | null; // [timestamp, dailyFees]
  methodology: {
    Fees?: string;
    Revenue?: string;
    ProtocolRevenue?: string;
    SupplySideRevenue?: string;
  };
}

export interface FeesChartData {
  date: string;
  value: number;
}

/**
 * Fetch fees summary from DefiLlama
 */
export async function fetchDefiLlamaFees(): Promise<DefiLlamaFeesResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_API_TIMEOUT_MS);

    const response = await fetch(
      `${DEFILLAMA_API_BASE}/summary/fees/${PROTOCOL_SLUG}?dataType=dailyFees`,
      { 
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`DefiLlama API returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data as DefiLlamaFeesResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('DefiLlama API request timed out');
    } else {
      console.warn('Failed to fetch DefiLlama fees:', error);
    }
    return null;
  }
}

/**
 * Get cumulative fees chart data from DefiLlama
 * DefiLlama returns daily fees - we convert to cumulative for trend display
 */
export function getFeesChartData(response: DefiLlamaFeesResponse): FeesChartData[] {
  if (!response.totalDataChart || response.totalDataChart.length === 0) {
    return [];
  }

  let cumulative = 0;
  return response.totalDataChart.map(([timestamp, dailyValue]) => {
    cumulative += dailyValue || 0;
    return {
      date: new Date(timestamp * 1000).toISOString(),
      value: cumulative,
    };
  });
}

/**
 * Get daily fees chart data (non-cumulative)
 */
export function getDailyFeesChartData(response: DefiLlamaFeesResponse): FeesChartData[] {
  if (!response.totalDataChart || response.totalDataChart.length === 0) {
    return [];
  }

  return response.totalDataChart.map(([timestamp, dailyValue]) => ({
    date: new Date(timestamp * 1000).toISOString(),
    value: dailyValue || 0,
  }));
}
