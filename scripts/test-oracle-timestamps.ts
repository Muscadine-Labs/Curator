#!/usr/bin/env tsx
/**
 * Test script to verify oracle timestamp data is being returned correctly
 * Tests the market risk API endpoint for a USDC vault
 */

const USDC_VAULT_ADDRESS = '0xf7e26Fa48A568b8b0038e104DfD8ABdf0f99074F';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function testOracleTimestamps() {
  console.log(`Testing oracle timestamps for USDC vault: ${USDC_VAULT_ADDRESS}\n`);
  console.log(`API URL: ${API_BASE_URL}\n`);

  try {
    const response = await fetch(`${API_BASE_URL}/api/vaults/v1/${USDC_VAULT_ADDRESS}/market-risk`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}):`, errorText);
      process.exit(1);
    }

    const data = await response.json();
    
    console.log(`✅ API Response received\n`);
    console.log(`Vault Address: ${data.vaultAddress}`);
    console.log(`Number of markets: ${data.markets.length}\n`);

    // Check each market for oracle timestamp data
    data.markets.forEach((market: any, index: number) => {
      const marketName = market.market.collateralAsset?.symbol && market.market.loanAsset?.symbol
        ? `${market.market.collateralAsset.symbol}/${market.market.loanAsset.symbol}`
        : market.market.loanAsset?.symbol || market.market.collateralAsset?.symbol || 'Unknown';
      
      console.log(`\n--- Market ${index + 1}: ${marketName} ---`);
      console.log(`Oracle Address: ${market.market.oracleAddress || 'N/A'}`);
      console.log(`Oracle Type: ${market.market.oracle?.type || 'N/A'}`);
      
      if (market.market.oracle?.data?.baseFeedOne?.address) {
        console.log(`BaseFeedOne (from GraphQL): ${market.market.oracle.data.baseFeedOne.address}`);
      } else {
        console.log(`BaseFeedOne (from GraphQL): Not available`);
      }

      if (market.oracleTimestampData) {
        console.log(`\n✅ Oracle Timestamp Data:`);
        console.log(`  Chainlink Address: ${market.oracleTimestampData.chainlinkAddress || 'N/A'}`);
        
        if (market.oracleTimestampData.updatedAt) {
          const date = new Date(market.oracleTimestampData.updatedAt * 1000);
          const year = date.getUTCFullYear();
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const month = monthNames[date.getUTCMonth()];
          const day = String(date.getUTCDate()).padStart(2, '0');
          const hours = String(date.getUTCHours()).padStart(2, '0');
          const minutes = String(date.getUTCMinutes()).padStart(2, '0');
          const seconds = String(date.getUTCSeconds()).padStart(2, '0');
          const formatted = `${day} ${month} ${year}, ${hours}:${minutes}:${seconds} UTC`;
          
          console.log(`  Updated At (Unix): ${market.oracleTimestampData.updatedAt}`);
          console.log(`  Updated At (Formatted): ${formatted}`);
          console.log(`  Age (seconds): ${market.oracleTimestampData.ageSeconds || 'N/A'}`);
          console.log(`  Age (hours): ${market.oracleTimestampData.ageSeconds ? (market.oracleTimestampData.ageSeconds / 3600).toFixed(2) : 'N/A'}`);
        } else {
          console.log(`  Updated At: Not available`);
        }
      } else {
        console.log(`\n❌ No Oracle Timestamp Data`);
      }

      if (market.scores) {
        console.log(`\nOracle Score: ${market.scores.oracleScore.toFixed(2)}`);
      }
    });

    console.log(`\n\n✅ Test completed successfully!`);
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testOracleTimestamps();

