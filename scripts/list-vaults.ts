/**
 * Script to list all vaults and their metadata
 * Run with: npx tsx scripts/list-vaults.ts
 */

import { vaultAddresses } from '../lib/config/vaults';
import { BASE_CHAIN_ID } from '../lib/constants';
import { morphoGraphQLClient } from '../lib/morpho/graphql-client';
import { gql } from 'graphql-request';
import { getAddress } from 'viem';

async function listVaults() {
  console.log('=== Configured Vault Addresses ===\n');
  vaultAddresses.forEach((vault, index) => {
    console.log(`${index + 1}. Address: ${vault.address}`);
    console.log(`   Chain ID: ${vault.chainId}\n`);
  });

  console.log('\n=== Fetching Metadata from GraphQL ===\n');
  
  const addresses = vaultAddresses.map(v => getAddress(v.address));

  // Fetch V1 vaults
  const v1Query = gql`
    query FetchV1Vaults($addresses: [String!]) {
      vaults(
        first: 1000
        where: { address_in: $addresses, chainId_in: [${BASE_CHAIN_ID}] }
      ) {
        items {
          address
          name
          whitelisted
          asset { address symbol decimals }
          state {
            totalAssetsUsd
            weeklyNetApy
            monthlyNetApy
            fee
          }
        }
      }
    }
  `;

  // Fetch V2 vaults individually
  const v2VaultPromises = addresses.map(async (address) => {
    try {
      const v2Query = gql`
        query FetchV2Vault($address: String!, $chainId: Int!) {
          vaultV2ByAddress(address: $address, chainId: $chainId) {
            address
            name
            symbol
            asset { address symbol decimals }
            performanceFee
            totalAssetsUsd
            avgApy
            avgNetApy
          }
        }
      `;
      const result = await morphoGraphQLClient.request<{ vaultV2ByAddress?: { address: string; name: string; symbol?: string; asset?: { address?: string; symbol?: string; decimals?: number }; performanceFee?: number; totalAssetsUsd?: number; avgApy?: number; avgNetApy?: number } | null }>(v2Query, { address, chainId: BASE_CHAIN_ID });
      return result.vaultV2ByAddress;
    } catch {
      return null;
    }
  });

  try {
    const [v1Data, v2Results] = await Promise.all([
      morphoGraphQLClient.request<{ vaults?: { items?: Array<{ address: string; name: string; whitelisted?: boolean; asset?: { address?: string; symbol?: string; decimals?: number }; state?: { totalAssetsUsd?: number; weeklyNetApy?: number; monthlyNetApy?: number; fee?: number } | null } | null> | null } | null }>(v1Query, { addresses }),
      Promise.all(v2VaultPromises),
    ]);

    const v1Vaults = (v1Data.vaults?.items?.filter((v): v is NonNullable<typeof v> => v !== null) ?? []) as Array<{ address: string; name: string; whitelisted?: boolean; asset?: { address?: string; symbol?: string; decimals?: number }; state?: { totalAssetsUsd?: number; weeklyNetApy?: number; monthlyNetApy?: number; fee?: number } | null }>;
    const v2Vaults = v2Results.filter((v): v is NonNullable<typeof v> => v !== null);

    console.log('=== V1 Vaults ===\n');
    if (v1Vaults.length === 0) {
      console.log('No V1 vaults found.\n');
    } else {
      v1Vaults.forEach((vault, index) => {
        console.log(`${index + 1}. ${vault.name || 'Unknown'}`);
        console.log(`   Address: ${vault.address}`);
        console.log(`   Symbol: ${vault.asset?.symbol || 'N/A'}`);
        console.log(`   Asset Address: ${vault.asset?.address || 'N/A'}`);
        console.log(`   Whitelisted: ${vault.whitelisted ? 'Yes' : 'No'}`);
        console.log(`   TVL: $${vault.state?.totalAssetsUsd?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`);
        console.log(`   Weekly Net APY: ${((vault.state?.weeklyNetApy || 0) * 100).toFixed(2)}%`);
        console.log(`   Monthly Net APY: ${((vault.state?.monthlyNetApy || 0) * 100).toFixed(2)}%`);
        console.log(`   Performance Fee: ${((vault.state?.fee || 0) * 100).toFixed(2)}%`);
        console.log('');
      });
    }

    console.log('=== V2 Vaults ===\n');
    if (v2Vaults.length === 0) {
      console.log('No V2 vaults found.\n');
    } else {
      v2Vaults.forEach((vault, index) => {
        console.log(`${index + 1}. ${vault.name || 'Unknown'}`);
        console.log(`   Address: ${vault.address}`);
        console.log(`   Symbol: ${vault.symbol || vault.asset?.symbol || 'N/A'}`);
        console.log(`   Asset Symbol: ${vault.asset?.symbol || 'N/A'}`);
        console.log(`   Asset Address: ${vault.asset?.address || 'N/A'}`);
        console.log(`   TVL: $${vault.totalAssetsUsd?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`);
        console.log(`   Avg APY: ${((vault.avgApy || 0) * 100).toFixed(2)}%`);
        console.log(`   Avg Net APY: ${((vault.avgNetApy || 0) * 100).toFixed(2)}%`);
        console.log(`   Performance Fee: ${((vault.performanceFee || 0) * 100).toFixed(2)}%`);
        console.log('');
      });
    }

    // Summary
    console.log('=== Summary ===\n');
    console.log(`Total Configured Addresses: ${vaultAddresses.length}`);
    console.log(`V1 Vaults Found: ${v1Vaults.length}`);
    console.log(`V2 Vaults Found: ${v2Vaults.length}`);
    console.log(`Total Vaults Found: ${v1Vaults.length + v2Vaults.length}`);
    
  } catch (error) {
    console.error('Error fetching vault data:', error);
    process.exit(1);
  }
}

listVaults();

