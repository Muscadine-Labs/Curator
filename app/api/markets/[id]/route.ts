import { NextRequest, NextResponse } from 'next/server';

const MORPHO_GRAPHQL_ENDPOINT = 'https://api.morpho.org/graphql';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: uniqueKey } = await params;
    const chainId = 8453; // Base chain

    const variables = {
      uniqueKey,
      chainId,
      options: {
        startTimestamp: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60, // 30 days ago
        endTimestamp: Math.floor(Date.now() / 1000),
        interval: 'DAY'
      }
    };

    const query = `
      query MarketDetail($uniqueKey: String!, $chainId: Int!, $options: TimeseriesOptions) {
        marketByUniqueKey(uniqueKey: $uniqueKey, chainId: $chainId) {
          uniqueKey
          lltv
          oracleAddress
          irmAddress
          whitelisted
          creationBlockNumber
          creationTimestamp
          creatorAddress
          
          loanAsset {
            address
            symbol
            name
            decimals
            priceUsd
          }
          
          collateralAsset {
            address
            symbol
            name
            decimals
            priceUsd
          }
          
          oracle {
            address
            type
            creationEvent {
              txHash
              timestamp
              blockNumber
            }
            data {
              ... on MorphoChainlinkOracleV2Data {
                baseFeedOne {
                  address
                  description
                  vendor
                  pair
                }
                baseFeedTwo {
                  address
                  description
                }
                baseVaultConversionSample
                quoteFeedOne {
                  address
                  description
                }
                quoteFeedTwo {
                  address
                  description
                }
                quoteVaultConversionSample
              }
              ... on MorphoChainlinkOracleData {
                baseFeedOne {
                  address
                  description
                  vendor
                  pair
                }
                baseOracleVault {
                  address
                }
              }
            }
          }
          
          oracleInfo {
            type
          }
          
          state {
            collateralAssets
            collateralAssetsUsd
            borrowAssets
            borrowAssetsUsd
            supplyAssets
            supplyAssetsUsd
            liquidityAssets
            liquidityAssetsUsd
            utilization
            supplyApy
            borrowApy
            avgSupplyApy
            avgBorrowApy
            avgNetSupplyApy
            avgNetBorrowApy
            fee
            rateAtUTarget
            rewards {
              asset {
                address
                symbol
                name
                chain {
                  id
                }
              }
              supplyApr
              borrowApr
              amountPerYear
              yearlySupplyTokens
              yearlyBorrowTokens
            }
          }
          
          warnings {
            type
            level
          }
          
          dailyApys {
            netSupplyApy
            netBorrowApy
          }
          
          weeklyApys {
            netSupplyApy
            netBorrowApy
          }
          
          monthlyApys {
            netSupplyApy
            netBorrowApy
          }
          
          supplyingVaults {
            address
            name
            symbol
            metadata {
              description
            }
          }
          
          historicalState {
            supplyApy(options: $options) {
              x
              y
            }
            borrowApy(options: $options) {
              x
              y
            }
            supplyAssetsUsd(options: $options) {
              x
              y
            }
            borrowAssetsUsd(options: $options) {
              x
              y
            }
          }
        }
        
        positions: marketPositions(
          first: 100
          orderBy: SupplyShares
          orderDirection: Desc
          where: { marketUniqueKey_in: [$uniqueKey] }
        ) {
          items {
            user {
              address
            }
            state {
              supplyShares
              supplyAssets
              supplyAssetsUsd
              borrowShares
              borrowAssets
              borrowAssetsUsd
              collateral
              collateralUsd
            }
          }
        }
        
        liquidations: transactions(
          first: 50
          orderBy: Timestamp
          orderDirection: Desc
          where: {
            marketUniqueKey_in: [$uniqueKey]
            type_in: [MarketLiquidation]
          }
        ) {
          items {
            blockNumber
            hash
            timestamp
            type
            user {
              address
            }
            data {
              ... on MarketLiquidationTransactionData {
                seizedAssets
                repaidAssets
                seizedAssetsUsd
                repaidAssetsUsd
                badDebtAssetsUsd
                liquidator
              }
            }
          }
        }
      }
    `;

    const resp = await fetch(MORPHO_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `Morpho API error: ${text}` }, { status: 502 });
    }

    const json = await resp.json();
    
    if (json.errors) {
      console.error('GraphQL errors:', json.errors);
      return NextResponse.json({ error: json.errors }, { status: 502 });
    }

    const market = json?.data?.marketByUniqueKey;
    const positions = json?.data?.positions?.items || [];
    const liquidations = json?.data?.liquidations?.items || [];

    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    // Transform the data for easier consumption
    const result = {
      uniqueKey: market.uniqueKey,
      lltv: market.lltv,
      oracleAddress: market.oracleAddress,
      irmAddress: market.irmAddress,
      whitelisted: market.whitelisted,
      creationBlockNumber: market.creationBlockNumber,
      creationTimestamp: market.creationTimestamp,
      creatorAddress: market.creatorAddress,
      
      loanAsset: market.loanAsset,
      collateralAsset: market.collateralAsset,
      oracle: market.oracle,
      oracleInfo: market.oracleInfo,
      
      state: {
        ...market.state,
        rewards: (market.state?.rewards || []).map((r: any) => ({
          asset: r.asset,
          supplyApr: (r.supplyApr || 0) * 100,
          borrowApr: (r.borrowApr || 0) * 100,
          amountPerYear: r.amountPerYear,
          yearlySupplyTokens: r.yearlySupplyTokens,
          yearlyBorrowTokens: r.yearlyBorrowTokens,
        }))
      },
      
      warnings: market.warnings || [],
      
      apyMetrics: {
        daily: market.dailyApys,
        weekly: market.weeklyApys,
        monthly: market.monthlyApys,
      },
      
      supplyingVaults: market.supplyingVaults || [],
      
      historicalData: {
        supplyApy: market.historicalState?.supplyApy || [],
        borrowApy: market.historicalState?.borrowApy || [],
        supplyAssetsUsd: market.historicalState?.supplyAssetsUsd || [],
        borrowAssetsUsd: market.historicalState?.borrowAssetsUsd || [],
      },
      
      positions: positions.map((p: any) => ({
        userAddress: p.user?.address,
        ...p.state
      })),
      
      liquidations: liquidations.map((l: any) => ({
        blockNumber: l.blockNumber,
        hash: l.hash,
        timestamp: l.timestamp,
        userAddress: l.user?.address,
        ...l.data
      }))
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('Market API error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

