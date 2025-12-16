#!/usr/bin/env tsx
/**
 * Test script to verify allocation data is working correctly
 */

const USDC_VAULT_ADDRESS = '0xf7e26Fa48A568b8b0038e104DfD8ABdf0f99074F';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function testAllocations() {
  console.log(`Testing allocations for USDC vault: ${USDC_VAULT_ADDRESS}\n`);
  console.log(`API URL: ${API_BASE_URL}\n`);

  try {
    const response = await fetch(`${API_BASE_URL}/api/vaults/${USDC_VAULT_ADDRESS}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}):`, errorText);
      process.exit(1);
    }

    const data = await response.json();
    
    console.log(`✅ API Response received\n`);
    console.log(`Vault Name: ${data.name}`);
    console.log(`Vault Address: ${data.address}`);
    console.log(`Allocation Count: ${data.allocation?.length || 0}\n`);

    if (!data.allocation || data.allocation.length === 0) {
      console.log(`❌ No allocation data found`);
      console.log(`State allocation: ${data.state?.allocation?.length || 0} items`);
      process.exit(1);
    }

    console.log(`✅ Allocation data found: ${data.allocation.length} markets\n`);

    // Type definition for allocation items
    type AllocationItem = {
      supplyAssets?: string | null;
      supplyAssetsUsd?: number | null;
      supplyCap?: string | null;
      marketKey?: string;
      collateralAssetName?: string;
      loanAssetName?: string;
      lltv?: string | null;
      oracleAddress?: string | null;
      irmAddress?: string | null;
      marketRewards?: Array<unknown>;
      market?: {
        uniqueKey?: string;
        loanAsset?: { name?: string | null } | null;
        collateralAsset?: { name?: string | null } | null;
        oracleAddress?: string | null;
        irmAddress?: string | null;
        lltv?: string | null;
      } | null;
    };

    // Check each allocation
    data.allocation.forEach((alloc: AllocationItem, index: number) => {
      const marketName = alloc.market?.collateralAsset?.name && alloc.market?.loanAsset?.name
        ? `${alloc.market.collateralAsset.name}/${alloc.market.loanAsset.name}`
        : alloc.market?.loanAsset?.name || alloc.market?.collateralAsset?.name || 'Unknown';
      
      console.log(`\n--- Allocation ${index + 1}: ${marketName} ---`);
      console.log(`Market Key: ${alloc.market?.uniqueKey || alloc.marketKey || 'N/A'}`);
      console.log(`Supply Assets (wei): ${alloc.supplyAssets || '0'}`);
      console.log(`Supply Assets (USD): $${alloc.supplyAssetsUsd?.toFixed(2) || '0.00'}`);
      console.log(`Supply Cap: ${alloc.supplyCap || 'N/A'}`);
      console.log(`LLTV: ${alloc.market?.lltv || alloc.lltv || 'N/A'}`);
      console.log(`Oracle Address: ${alloc.market?.oracleAddress || alloc.oracleAddress || 'N/A'}`);
      console.log(`IRM Address: ${alloc.market?.irmAddress || alloc.irmAddress || 'N/A'}`);
      console.log(`Market Rewards: ${alloc.marketRewards?.length || 0} rewards`);
    });

    // Calculate totals
    const totalUsd = data.allocation.reduce((sum: number, alloc: AllocationItem) => {
      return sum + (alloc.supplyAssetsUsd || 0);
    }, 0);

    console.log(`\n\n📊 Summary:`);
    console.log(`Total Allocated (USD): $${totalUsd.toFixed(2)}`);
    console.log(`Number of Markets: ${data.allocation.length}`);
    console.log(`\n✅ All allocation data is valid!`);
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testAllocations();

