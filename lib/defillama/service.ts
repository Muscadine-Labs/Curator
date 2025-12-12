/**
 * DefiLlama API Service
 * 
 * Fetches fees, revenue, and TVL data from DefiLlama for Muscadine vaults.
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
}

export interface DefiLlamaProtocolResponse {
  id: string;
  name: string;
  tvl: Array<{ date: number; totalLiquidityUSD: number }> | null;
  chainTvls: Record<string, { tvl: Array<{ date: number; totalLiquidityUSD: number }> }> | null;
}

export interface ChartData {
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
        headers: { 'Accept': 'application/json' },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`DefiLlama fees API returned ${response.status}`);
      return null;
    }

    return await response.json() as DefiLlamaFeesResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('DefiLlama fees API request timed out');
    } else {
      console.warn('Failed to fetch DefiLlama fees:', error);
    }
    return null;
  }
}

/**
 * Fetch protocol TVL data from DefiLlama
 */
export async function fetchDefiLlamaProtocol(): Promise<DefiLlamaProtocolResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_API_TIMEOUT_MS);

    const response = await fetch(
      `${DEFILLAMA_API_BASE}/protocol/${PROTOCOL_SLUG}`,
      { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`DefiLlama protocol API returned ${response.status}`);
      return null;
    }

    return await response.json() as DefiLlamaProtocolResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('DefiLlama protocol API request timed out');
    } else {
      console.warn('Failed to fetch DefiLlama protocol:', error);
    }
    return null;
  }
}

/**
 * Get cumulative fees chart data from DefiLlama
 */
export function getCumulativeFeesChart(response: DefiLlamaFeesResponse): ChartData[] {
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
 * Get cumulative revenue chart data (curator fees = total fees * performance fee rate)
 */
export function getCumulativeRevenueChart(response: DefiLlamaFeesResponse, performanceFeeRate: number = 0.02): ChartData[] {
  if (!response.totalDataChart || response.totalDataChart.length === 0) {
    return [];
  }

  let cumulative = 0;
  return response.totalDataChart.map(([timestamp, dailyValue]) => {
    cumulative += (dailyValue || 0) * performanceFeeRate;
    return {
      date: new Date(timestamp * 1000).toISOString(),
      value: cumulative,
    };
  });
}

/**
 * Get daily inflows chart data from TVL changes
 * Shows the daily change in TVL (positive = inflow, negative = outflow)
 */
export function getDailyInflowsChart(response: DefiLlamaProtocolResponse): ChartData[] {
  if (!response.tvl || response.tvl.length < 2) {
    return [];
  }

  const result: ChartData[] = [];

  for (let i = 1; i < response.tvl.length; i++) {
    const prev = response.tvl[i - 1];
    const curr = response.tvl[i];
    const change = curr.totalLiquidityUSD - prev.totalLiquidityUSD;
    
    result.push({
      date: new Date(curr.date * 1000).toISOString(),
      value: change,
    });
  }

  return result;
}

/**
 * Get cumulative inflows chart data from TVL changes
 * Positive changes = inflows, negative = outflows
 */
export function getCumulativeInflowsChart(response: DefiLlamaProtocolResponse): ChartData[] {
  if (!response.tvl || response.tvl.length < 2) {
    return [];
  }

  const result: ChartData[] = [];
  let cumulativeInflow = 0;

  for (let i = 1; i < response.tvl.length; i++) {
    const prev = response.tvl[i - 1];
    const curr = response.tvl[i];
    const change = curr.totalLiquidityUSD - prev.totalLiquidityUSD;
    
    // Track cumulative inflows (only positive changes)
    if (change > 0) {
      cumulativeInflow += change;
    }
    
    result.push({
      date: new Date(curr.date * 1000).toISOString(),
      value: cumulativeInflow,
    });
  }

  return result;
}
