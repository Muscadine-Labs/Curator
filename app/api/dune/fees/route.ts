import { NextResponse } from 'next/server';
import { 
  executeDuneQueryAndWait, 
  getLatestDuneQueryResults,
  type DuneQueryParams,
  type DuneRow
} from '@/lib/dune/service';
import { vaults } from '@/lib/config/vaults';

interface FeeHistoryItem {
  date: string;
  amount: number;
  token: string;
  vault: string;
}

interface FeesTrendItem {
  date: string;
  value: number;
}

/**
 * Dune Query IDs for fee analytics
 * These correspond to the queries on Dune Analytics
 */
const DUNE_QUERY_IDS = {
  // Single vault performance query (from the provided Dune link)
  SINGLE_VAULT_PERFORMANCE: 5930091,
  // Add more query IDs as needed
} as const;

/**
 * Transform Dune query results to our fee data format
 * 
 * NOTE: You may need to adjust the column name mappings below based on your actual Dune query structure.
 * To find the correct column names:
 * 1. Run your Dune query and check the result columns
 * 2. Update the fallback column names in the mappings below (e.g., row.total_fees, row.date, etc.)
 * 3. The function tries multiple column name variations for flexibility
 */
function transformDuneResultsToFeeData(duneResults: { result?: { rows?: DuneRow[] } }) {
  if (!duneResults?.result?.rows) {
    return {
      totalFeesGenerated: 0,
      feeHistory: [],
      feesTrend: [],
    };
  }

  const rows = duneResults.result.rows;
  
  // Calculate total fees (sum of all fees)
  // Adjust column names based on actual Dune query structure
  // Common column names: total_fees, fees, amount, fee_amount, cumulative_fees
  const totalFeesGenerated = rows.reduce((sum: number, row: DuneRow) => {
    const feeAmount = row.total_fees || row.fees || row.amount || row.fee_amount || row.cumulative_fees || 0;
    return sum + (typeof feeAmount === 'number' ? feeAmount : parseFloat(String(feeAmount)) || 0);
  }, 0);

  // Transform rows to fee history format
  // Adjust column names: date, timestamp, time, block_time for dates
  // Adjust column names: token, asset, symbol for token names
  // Adjust column names: vault_name, vault, vault_address for vault identifiers
  const feeHistory: FeeHistoryItem[] = rows
    .map((row: DuneRow) => {
      // Map Dune columns to our format - try multiple column name variations
      const date = row.date || row.timestamp || row.time || row.block_time || row.day;
      const amount = row.total_fees || row.fees || row.amount || row.fee_amount || row.daily_fees || 0;
      const token = row.token || row.asset || row.symbol || 'USDC';
      const vault = row.vault_name || row.vault || row.vault_address || 'Unknown Vault';

      return {
        date: date ? new Date(String(date)).toISOString() : new Date().toISOString(),
        amount: typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0,
        token: String(token),
        vault: String(vault),
      };
    })
    .filter((fee: FeeHistoryItem) => fee.amount > 0)
    .sort((a: FeeHistoryItem, b: FeeHistoryItem) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Create fees trend for chart (daily aggregation)
  // This aggregates fees by date for the chart visualization
  const dailyFees = feeHistory.reduce((acc: Record<string, number>, fee: FeeHistoryItem) => {
    const dateKey = new Date(fee.date).toISOString().split('T')[0];
    acc[dateKey] = (acc[dateKey] || 0) + fee.amount;
    return acc;
  }, {});

  const feesTrend: FeesTrendItem[] = Object.entries(dailyFees)
    .map(([date, value]) => ({
      date,
      value: value as number,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    totalFeesGenerated,
    feeHistory: feeHistory.slice(0, 100), // Limit to last 100 entries
    feesTrend,
  };
}

/**
 * Fetch fees data for all vaults or a specific vault
 */
async function fetchFeesForVaults(vaultAddresses?: string[]) {
  const results: DuneRow[] = [];

  // If no specific vaults, fetch for all active vaults
  const targetVaults = vaultAddresses 
    ? vaults.filter(v => vaultAddresses.includes(v.address.toLowerCase()))
    : vaults.filter(v => v.status === 'active');

  // Fetch data for each vault
  for (const vault of targetVaults) {
    try {
      // Build query parameters based on vault
      // Dune queries use specific parameter names - try the most common one first
      // Based on the provided Dune links, the parameter appears to be vault_name_e15077
      const vaultParamValue = `${vault.name} - base - ${vault.address}`;
      const params: DuneQueryParams = {
        vault_name_e15077: vaultParamValue,
      };

      // Try to get latest results first (faster)
      let duneResult = await getLatestDuneQueryResults(
        DUNE_QUERY_IDS.SINGLE_VAULT_PERFORMANCE,
        params
      );

      // If no latest results, execute and wait
      if (!duneResult || duneResult.state !== 'QUERY_STATE_COMPLETED') {
        duneResult = await executeDuneQueryAndWait(
          DUNE_QUERY_IDS.SINGLE_VAULT_PERFORMANCE,
          params
        );
      }

      if (duneResult?.result?.rows) {
        results.push(...duneResult.result.rows);
      }
    } catch (error) {
      console.error(`Error fetching Dune data for vault ${vault.address}:`, error);
      // Continue with other vaults even if one fails
    }
  }

  return transformDuneResultsToFeeData({ result: { rows: results } });
}

export async function GET(request: Request) {
  try {
    // Check if Dune API key is configured
    if (!process.env.DUNE_API_KEY) {
      return NextResponse.json(
        { 
          error: 'Dune API key not configured',
          message: 'Please set DUNE_API_KEY environment variable'
        },
        { status: 500 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const vaultsParam = searchParams.get('vaults');
    const vaultAddresses = vaultsParam ? vaultsParam.split(',').map(a => a.toLowerCase()) : undefined;

    // Fetch fees data
    const feesData = await fetchFeesForVaults(vaultAddresses);

    // Add performance fee rate (2% = 200 bps)
    const feesDataWithMetadata = {
      ...feesData,
      performanceFeeBps: 200, // 2%
    };

    return NextResponse.json(feesDataWithMetadata);
  } catch (error) {
    console.error('Error fetching Dune fees data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch fees data from Dune',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

