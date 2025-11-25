import { NextResponse } from 'next/server';
import { vaults as configuredVaults } from '@/lib/config/vaults';
import { 
  executeDuneQueryAndWait, 
  getLatestDuneQueryResults,
  type DuneQueryParams 
} from '@/lib/dune/service';

const MORPHO_GRAPHQL_ENDPOINT = 'https://api.morpho.org/graphql';

type MorphoVaultItem = {
  address: string;
  state: {
    totalAssetsUsd: number | null;
    fee: number | null;
  };
};

type MorphoPositionItem = {
  vault: { address: string };
  user: { address: string };
};

export async function GET() {
  try {
    const addresses = configuredVaults.map(v => v.address.toLowerCase());

    const query = `
      query FetchProtocolStats($addresses: [String!]) {
        vaults(
          first: 1000
          where: { address_in: $addresses, chainId_in: [8453] }
        ) {
          items {
            address
            state { 
              totalAssetsUsd
              fee
            }
          }
        }

        vaultPositions(
          first: 1000
          where: { vaultAddress_in: $addresses }
        ) {
          items {
            vault { address }
            user { address }
          }
        }
      }
    `;

    const response = await fetch(MORPHO_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { addresses } }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `Morpho API error: ${text}` }, { status: 502 });
    }

    const json = await response.json();
    if (json.errors) {
      return NextResponse.json({ error: json.errors }, { status: 502 });
    }

    const morphoVaults: MorphoVaultItem[] = json?.data?.vaults?.items ?? [];
    const positions: MorphoPositionItem[] = json?.data?.vaultPositions?.items ?? [];

    const totalDeposited = morphoVaults.reduce((sum, v) => sum + (v.state.totalAssetsUsd ?? 0), 0);
    const activeVaults = configuredVaults.length;
    
    // Calculate total fees from Morpho (fallback)
    let totalFeesGenerated = morphoVaults.reduce((sum, v) => sum + (v.state.fee ?? 0), 0);
    
    // Total interest generated is approximately the fees generated (in a MetaMorpho vault, fees = performance fees from interest)
    // For more accurate calculation, we'd need historical APY data
    const totalInterestGenerated = totalFeesGenerated;

    // Unique depositors across our vaults
    const uniqueUsers = new Set<string>();
    for (const p of positions) uniqueUsers.add(p.user.address.toLowerCase());

    // Minimal placeholder trends (current TVL as a flat series) to avoid mocks
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const tvlTrend = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      return { date: date.toISOString(), value: totalDeposited };
    });

    // Try to fetch fees trend from Dune Analytics
    let feesTrend: Array<{ date: string; value: number }> = [];
    let duneTotalFees = totalFeesGenerated;
    
    try {
      if (process.env.DUNE_API_KEY) {
        // Fetch fees data for all active vaults
        const activeVaults = configuredVaults.filter(v => v.status === 'active');
        const allRows: Array<Record<string, unknown>> = [];
        
        for (const vault of activeVaults) {
          try {
            const vaultParamValue = `${vault.name} - base - ${vault.address}`;
            const params: DuneQueryParams = {
              vault_name_e15077: vaultParamValue,
            };
            
            // Try to get latest results first
            let duneResult = await getLatestDuneQueryResults(5930091, params);
            
            // If no latest results, execute and wait
            if (!duneResult || duneResult.state !== 'QUERY_STATE_COMPLETED') {
              duneResult = await executeDuneQueryAndWait(5930091, params);
            }
            
            if (duneResult?.result?.rows) {
              allRows.push(...duneResult.result.rows);
            }
          } catch (error) {
            // Continue with other vaults if one fails
            console.error(`Error fetching Dune data for vault ${vault.address}:`, error);
          }
        }
        
        // Transform Dune results
        if (allRows.length > 0) {
          // Calculate total fees
          duneTotalFees = allRows.reduce((sum, row) => {
            const feeAmount = row.total_fees || row.fees || row.amount || row.fee_amount || 0;
            return sum + (typeof feeAmount === 'number' ? feeAmount : parseFloat(String(feeAmount)) || 0);
          }, 0);
          
          // Create fees trend
          const dailyFees = allRows.reduce((acc: Record<string, number>, row: Record<string, unknown>) => {
            const date = row.date || row.timestamp || row.time || row.block_time;
            const amount = row.total_fees || row.fees || row.amount || row.fee_amount || 0;
            if (date) {
              const dateKey = new Date(String(date)).toISOString().split('T')[0];
              acc[dateKey] = (acc[dateKey] || 0) + (typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0);
            }
            return acc;
          }, {});
          
          feesTrend = Object.entries(dailyFees)
            .map(([date, value]) => ({
              date,
              value: value as number,
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }
        
        // Use Dune total fees if available
        if (duneTotalFees > 0) {
          totalFeesGenerated = duneTotalFees;
        }
      }
    } catch (error) {
      // Silently fail - use empty array if Dune fetch fails
      console.error('Failed to fetch fees trend from Dune:', error);
    }

    const stats = {
      totalDeposited,
      totalFeesGenerated,
      activeVaults,
      totalInterestGenerated,
      users: uniqueUsers.size,
      tvlTrend,
      feesTrend,
    };

    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}


