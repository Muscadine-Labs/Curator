import { getAddress } from 'viem';
import { fetchV1VaultMarkets } from '@/lib/morpho/query-v1-vault-markets';
import { computeV1MarketRiskScores, isMarketIdle } from '@/lib/morpho/compute-v1-market-risk';
import { getOracleTimestampData } from '@/lib/morpho/oracle-utils';
import { getIRMTargetUtilizationWithFallback } from '@/lib/morpho/irm-utils';
import { BASE_CHAIN_ID } from '@/lib/constants';
import type { Address } from 'viem';

const VAULT_ADDRESS = '0xAeCc8113a7bD0CFAF7000EA7A31afFD4691ff3E9';

async function main() {
  console.log(`\n📊 Fetching market metrics for vault: ${VAULT_ADDRESS}\n`);
  
  try {
    const address = getAddress(VAULT_ADDRESS);
    
    // Fetch markets
    const markets = await fetchV1VaultMarkets(address, BASE_CHAIN_ID);
    
    if (markets.length === 0) {
      console.log('❌ No markets found for this vault');
      return;
    }
    
    console.log(`Found ${markets.length} market(s)\n`);
    console.log('═'.repeat(80));
    
    // Fetch oracle and IRM data for all markets in parallel
    const marketDataPromises = markets.map(async (market) => {
      if (isMarketIdle(market)) {
        return {
          oracleTimestampData: null,
          targetUtilization: null,
        };
      }
      
      const [oracleTimestampData, targetUtilization] = await Promise.all([
        getOracleTimestampData(
          market.oracleAddress ? (market.oracleAddress as Address) : null
        ),
        getIRMTargetUtilizationWithFallback(
          market.irmAddress ? (market.irmAddress as Address) : null
        ),
      ]);
      
      return {
        oracleTimestampData,
        targetUtilization,
      };
    });
    
    const marketData = await Promise.all(marketDataPromises);
    
    // Compute scores for each market
    for (let i = 0; i < markets.length; i++) {
      const market = markets[i];
      const isIdle = isMarketIdle(market);
      
      const marketName = market.collateralAsset?.symbol && market.loanAsset?.symbol
        ? `${market.collateralAsset.symbol}/${market.loanAsset.symbol}`
        : market.loanAsset?.symbol || market.collateralAsset?.symbol || 'Unknown';
      
      console.log(`\n📈 Market ${i + 1}: ${marketName}`);
      console.log('─'.repeat(80));
      
      if (isIdle) {
        console.log('⚠️  Market is idle (no scoring)');
        continue;
      }
      
      // Compute scores
      const scores = await computeV1MarketRiskScores(
        market,
        marketData[i].oracleTimestampData,
        marketData[i].targetUtilization
      );
      
      // Display market details
      const lltvPercent = market.lltv 
        ? (Number(market.lltv) / 1e16).toFixed(2)
        : 'N/A';
      
      console.log(`\n🔹 Market Details:`);
      console.log(`   LTV: ${lltvPercent}%`);
      console.log(`   Oracle: ${market.oracleAddress || 'None'}`);
      console.log(`   IRM: ${market.irmAddress || 'None'}`);
      if (marketData[i].targetUtilization !== null) {
        console.log(`   Target Utilization: ${(marketData[i].targetUtilization * 100).toFixed(1)}%`);
      }
      
      // Market state
      const state = market.state;
      if (state) {
        console.log(`\n🔹 Market State:`);
        console.log(`   Supply: $${(state.supplyAssetsUsd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
        console.log(`   Borrow: $${(state.borrowAssetsUsd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
        console.log(`   Collateral: $${(state.collateralAssetsUsd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
        const utilization = state.utilization !== null 
          ? (state.utilization * 100).toFixed(2) 
          : state.supplyAssetsUsd && state.supplyAssetsUsd > 0
            ? ((state.borrowAssetsUsd || 0) / state.supplyAssetsUsd * 100).toFixed(2)
            : 'N/A';
        console.log(`   Utilization: ${utilization}%`);
        const availableLiquidity = (state.supplyAssetsUsd || 0) - (state.borrowAssetsUsd || 0);
        console.log(`   Available Liquidity: $${availableLiquidity.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
      }
      
      // Oracle freshness info
      if (marketData[i].oracleTimestampData?.ageSeconds !== null) {
        const ageHours = (marketData[i].oracleTimestampData?.ageSeconds || 0) / 3600;
        console.log(`\n🔹 Oracle Info:`);
        console.log(`   Age: ${ageHours.toFixed(2)} hours`);
        console.log(`   Chainlink Address: ${marketData[i].oracleTimestampData?.chainlinkAddress || 'N/A'}`);
      }
      
      // Display scores
      console.log(`\n🔹 Risk Scores:`);
      console.log(`   Liquidation Headroom: ${scores.liquidationHeadroomScore.toFixed(2)} (${scores.grade})`);
      console.log(`   Utilization:         ${scores.utilizationScore.toFixed(2)} (${scores.grade})`);
      console.log(`   Coverage Ratio:      ${scores.coverageRatioScore.toFixed(2)} (${scores.grade})`);
      console.log(`   Oracle Freshness:    ${scores.oracleScore.toFixed(2)} (${scores.grade})`);
      console.log(`\n   📊 Overall Risk Score: ${scores.marketRiskScore.toFixed(2)} (${scores.grade})`);
      
      // Vault allocation
      if (market.vaultSupplyAssetsUsd !== null) {
        const vaultAllocationPercent = market.vaultTotalAssetsUsd && market.vaultTotalAssetsUsd > 0
          ? (market.vaultSupplyAssetsUsd / market.vaultTotalAssetsUsd) * 100
          : 0;
        const marketSharePercent = market.marketTotalSupplyUsd && market.marketTotalSupplyUsd > 0
          ? (market.vaultSupplyAssetsUsd / market.marketTotalSupplyUsd) * 100
          : 0;
        
        console.log(`\n🔹 Vault Allocation:`);
        console.log(`   Vault Supply: $${market.vaultSupplyAssetsUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
        console.log(`   ${vaultAllocationPercent.toFixed(2)}% of vault`);
        console.log(`   ${marketSharePercent.toFixed(2)}% of market`);
      }
      
      console.log('═'.repeat(80));
    }
    
    console.log('\n✅ Done!\n');
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();


