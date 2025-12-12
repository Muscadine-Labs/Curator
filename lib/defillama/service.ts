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
  tokens: Array<{ date: number; tokens: Record<string, number> }> | null;
  tokensInUsd: Array<{ date: number; tokens: Record<string, number> }> | null;
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
 * Get daily USD inflows chart data
 * Calculates true inflows: (token quantity change) × (current price)
 * This separates actual deposits/withdrawals from price movements
 */
export function getDailyInflowsChart(response: DefiLlamaProtocolResponse): ChartData[] {
  const tokens = response.tokens;
  const tokensInUsd = response.tokensInUsd;

  // If we have token data, calculate true USD inflows
  // Formula: (token quantity change) × (current price per token)
  // This separates actual deposits/withdrawals from price movements
  if (tokens && tokensInUsd && tokens.length >= 2 && tokensInUsd.length >= 2) {
    const result: ChartData[] = [];
    
    for (let i = 1; i < tokens.length; i++) {
      const prevTokens = tokens[i - 1].tokens;
      const currTokens = tokens[i].tokens;
      const currTokensUsd = tokensInUsd[i].tokens;
      
      let dailyInflow = 0;
      
      // For each token, calculate: (quantity change) × (current price per token)
      for (const symbol of Object.keys(currTokens)) {
        const prevQty = prevTokens[symbol] || 0;
        const currQty = currTokens[symbol] || 0;
        const currUsdValue = currTokensUsd[symbol] || 0;
        
        // Calculate current price per token
        const pricePerToken = currQty > 0 ? currUsdValue / currQty : 0;
        
        // USD inflow = quantity change × current price
        const qtyChange = currQty - prevQty;
        dailyInflow += qtyChange * pricePerToken;
      }
      
      result.push({
        date: new Date(tokens[i].date * 1000).toISOString(),
        value: dailyInflow,
      });
    }
    
    return result;
  }
  
  // Fallback to TVL change if token data not available
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
 * Get cumulative USD inflows chart data
 * Uses token quantity changes × current price, then accumulates
 */
export function getCumulativeInflowsChart(response: DefiLlamaProtocolResponse): ChartData[] {
  // First get the daily inflows
  const dailyInflows = getDailyInflowsChart(response);
  
  if (dailyInflows.length === 0) {
    return [];
  }

  const result: ChartData[] = [];
  let cumulative = 0;

  for (const day of dailyInflows) {
    cumulative += day.value;
    result.push({
      date: day.date,
      value: cumulative,
    });
  }

  return result;
}
