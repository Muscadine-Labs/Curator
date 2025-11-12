import { NextRequest, NextResponse } from 'next/server';
import { vaults } from '@/lib/config/vaults';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const asset = searchParams.get('asset');
  const status = searchParams.get('status');
  const riskTier = searchParams.get('riskTier');
  const search = searchParams.get('search');

  let filteredVaults = [...vaults];

  // Apply filters
  if (asset) {
    filteredVaults = filteredVaults.filter(vault => 
      vault.asset.toLowerCase() === asset.toLowerCase()
    );
  }

  if (status) {
    filteredVaults = filteredVaults.filter(vault => 
      vault.status === status
    );
  }

  if (riskTier) {
    filteredVaults = filteredVaults.filter(vault => 
      vault.riskTier === riskTier
    );
  }

  if (search) {
    const searchLower = search.toLowerCase();
    filteredVaults = filteredVaults.filter(vault => 
      vault.name.toLowerCase().includes(searchLower) ||
      vault.symbol.toLowerCase().includes(searchLower) ||
      vault.asset.toLowerCase().includes(searchLower)
    );
  }

  // Add mock data to each vault
  const vaultsWithData = filteredVaults.map(vault => ({
    ...vault,
    tvl: Math.random() * 25000000 + 10000000, // $10M - $35M
    apy7d: Math.random() * 5 + 3, // 3% - 8%
    apy30d: Math.random() * 4 + 4, // 4% - 8%
    depositors: Math.floor(Math.random() * 500) + 50, // 50 - 550
    utilization: Math.random() * 0.3 + 0.7, // 70% - 100%
    lastHarvest: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));

  return NextResponse.json(vaultsWithData);
}
