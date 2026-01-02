import { NextRequest, NextResponse } from 'next/server';
import { getVaultByAddress } from '@/lib/config/vaults';
import { handleApiError, AppError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';
import { getAddress, isAddress } from 'viem';
import { fetchV1VaultMarkets } from '@/lib/morpho/query-v1-vault-markets';
import { computeV1MarketRiskScores, isMarketIdle } from '@/lib/morpho/compute-v1-market-risk';
import { getOracleTimestampData } from '@/lib/morpho/oracle-utils';
import { getIRMTargetUtilizationWithFallback } from '@/lib/morpho/irm-utils';
import type { V1VaultMarketData } from '@/lib/morpho/query-v1-vault-markets';
import type { Address } from 'viem';

export interface V1MarketRiskData {
  market: V1VaultMarketData;
  scores: {
    liquidationHeadroomScore: number;
    utilizationScore: number;
    coverageRatioScore: number;
    oracleScore: number;
    marketRiskScore: number;
    grade: string;
    realizedBadDebt?: number | null;
    unrealizedBadDebt?: number | null;
  } | null; // null for idle markets
  oracleTimestampData?: {
    chainlinkAddress: string | null;
    updatedAt: number | null; // Unix timestamp in seconds
    ageSeconds: number | null;
  } | null;
  derived?: {
    lltvPct?: number | null;
    priceShockPct?: number | null;
    headroomUsd?: number | null;
    headroomRatioPct?: number | null;
    utilizationPct?: number | null;
    availableLiquidityUsd?: number | null;
    liquidatableBorrowUsd?: number | null;
    coverageRatio?: number | null;
    oracleAgeHours?: number | null;
    oracleAgeDays?: number | null;
    supplyApyPct?: number | null;
    borrowApyPct?: number | null;
  } | null;
}

export interface V1VaultMarketRiskResponse {
  vaultAddress: string;
  vaultLiquidity: number | null;
  markets: V1MarketRiskData[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rateLimitMiddleware = createRateLimitMiddleware(
    RATE_LIMIT_REQUESTS_PER_MINUTE,
    MINUTE_MS
  );
  const rateLimitResult = rateLimitMiddleware(request);
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { 
        status: 429,
        headers: rateLimitResult.headers,
      }
    );
  }

  try {
    const { id } = await params;
    
    // Check if id is a valid address
    let address: string;
    if (isAddress(id)) {
      address = getAddress(id);
    } else {
      // Try to find by address in config
      const cfg = getVaultByAddress(id);
      if (!cfg) {
        throw new AppError('Vault not found', 404, 'VAULT_NOT_FOUND');
      }
      address = getAddress(cfg.address);
    }

    // Check if address is in our configured list
    const cfg = getVaultByAddress(address);
    if (!cfg) {
      throw new AppError('Vault not found in configuration', 404, 'VAULT_NOT_FOUND');
    }

    // Fetch markets for this V1 vault
    const { markets, vaultLiquidity } = await fetchV1VaultMarkets(address, cfg.chainId);

    // Memoize oracle and IRM lookups to avoid duplicate RPC calls
    const oracleCache = new Map<string, Promise<Awaited<ReturnType<typeof getOracleTimestampData>>>>();
    const irmCache = new Map<string, Promise<number | null>>();

    // Fetch oracle timestamp data and IRM target utilization for all active markets in parallel
    const marketDataPromises = markets.map(async (market) => {
      if (isMarketIdle(market)) {
        return {
          oracleTimestampData: null,
          targetUtilization: null,
        };
      }

      // Extract baseFeedOne address from GraphQL oracle.data if available
      const baseFeedOneAddress = market.oracle?.data?.baseFeedOne?.address
        ? (market.oracle.data.baseFeedOne.address as Address)
        : null;

      const oracleAddress = market.oracleAddress ? (market.oracleAddress as Address) : null;
      const irmAddress = market.irmAddress ? (market.irmAddress as Address) : null;

      // Create cache keys
      const oracleKey = oracleAddress ? `${oracleAddress.toLowerCase()}-${baseFeedOneAddress?.toLowerCase() || 'null'}` : 'null';
      const irmKey = irmAddress ? irmAddress.toLowerCase() : 'null';

      // Use cached promise or create new one
      let oraclePromise = oracleCache.get(oracleKey);
      if (!oraclePromise) {
        oraclePromise = getOracleTimestampData(oracleAddress, baseFeedOneAddress);
        oracleCache.set(oracleKey, oraclePromise);
      }

      let irmPromise = irmCache.get(irmKey);
      if (!irmPromise) {
        irmPromise = getIRMTargetUtilizationWithFallback(irmAddress);
        irmCache.set(irmKey, irmPromise);
      }

      const [oracleTimestampData, targetUtilization] = await Promise.all([
        oraclePromise,
        irmPromise,
      ]);

      return {
        oracleTimestampData,
        targetUtilization,
      };
    });

    const marketData = await Promise.all(marketDataPromises);

    // Compute risk scores and derived metrics for each market (null for idle markets)
    const marketsWithScoresPromises = markets.map(async (market, index) => {
      if (isMarketIdle(market)) {
        return {
          market,
          scores: null,
          oracleTimestampData: null,
          derived: null,
        };
      }

      const scores = await computeV1MarketRiskScores(
        market,
        marketData[index].oracleTimestampData,
        marketData[index].targetUtilization
      );

      // Compute derived metrics for display (pre-computed server-side to reduce client work)
      const state = market.state;
      const lltvRaw = market.lltv;
      const lltvRatio = lltvRaw ? Number(lltvRaw) / 1e18 : null;
      const lltvPct = lltvRatio !== null ? lltvRatio * 100 : null;

      const loanAsset = market.loanAsset;
      const collateralAsset = market.collateralAsset;
      const loanSymbol = loanAsset?.symbol?.toUpperCase() || '';
      const collateralSymbol = collateralAsset?.symbol?.toUpperCase() || '';

      const isSameAsset =
        !!loanAsset &&
        !!collateralAsset &&
        (
          loanAsset.address.toLowerCase() === collateralAsset.address.toLowerCase() ||
          loanSymbol === collateralSymbol ||
          (['WSTETH', 'STETH', 'RETH', 'CBETH', 'WETH', 'ETH'].includes(loanSymbol) &&
            ['WSTETH', 'STETH', 'RETH', 'CBETH', 'WETH', 'ETH'].includes(collateralSymbol)) ||
          (['CBBTC', 'LBTC', 'WBTC', 'BTC'].includes(loanSymbol) &&
            ['CBBTC', 'LBTC', 'WBTC', 'BTC'].includes(collateralSymbol)) ||
          ((loanSymbol === 'USDC' || loanSymbol === 'USDC.E') &&
            (collateralSymbol === 'USDC' || collateralSymbol === 'USDC.E')) ||
          ((loanSymbol === 'USDT' || loanSymbol === 'USDT.E') &&
            (collateralSymbol === 'USDT' || collateralSymbol === 'USDT.E'))
        );

      const priceShock = isSameAsset ? 0.02 : 0.05; // 2.0% for same/derivative assets, 5% for different assets
      const priceShockPct = priceShock * 100;
      const shockMultiplier = 1 - priceShock;

      const collateralUsd = state?.collateralAssetsUsd ? Number(state.collateralAssetsUsd) : 0;
      const borrowUsd = state?.borrowAssetsUsd ? Number(state.borrowAssetsUsd) : 0;
      const supplyUsd = state?.supplyAssetsUsd ? Number(state.supplyAssetsUsd) : 0;

      const headroomUsd =
        borrowUsd > 0 && collateralUsd > 0 && lltvRatio !== null
          ? collateralUsd * shockMultiplier * lltvRatio - borrowUsd
          : null;
      const headroomRatioPct =
        headroomUsd !== null && borrowUsd > 0 ? (headroomUsd / borrowUsd) * 100 : null;

      const utilizationPct =
        state?.utilization !== null && state?.utilization !== undefined
          ? state.utilization * 100
          : supplyUsd > 0
            ? (borrowUsd / supplyUsd) * 100
            : null;

      const availableLiquidityUsd = supplyUsd - borrowUsd;

      const liquidatableBorrowUsd =
        borrowUsd > 0 && collateralUsd > 0 && lltvRatio !== null
          ? Math.max(0, borrowUsd - collateralUsd * shockMultiplier * lltvRatio)
          : null;

      const coverageRatio =
        liquidatableBorrowUsd !== null && liquidatableBorrowUsd > 0 && availableLiquidityUsd > 0
          ? availableLiquidityUsd / liquidatableBorrowUsd
          : liquidatableBorrowUsd === 0
            ? 1
            : null;

      const oracleAgeHours = marketData[index].oracleTimestampData?.ageSeconds
        ? marketData[index].oracleTimestampData.ageSeconds / 3600
        : null;
      const oracleAgeDays = oracleAgeHours !== null ? oracleAgeHours / 24 : null;

      const supplyApyPct =
        state?.supplyApy !== null && state?.supplyApy !== undefined
          ? state.supplyApy * 100
          : null;
      const borrowApyPct =
        state?.borrowApy !== null && state?.borrowApy !== undefined
          ? state.borrowApy * 100
          : null;

      return {
        market,
        scores,
        oracleTimestampData: marketData[index].oracleTimestampData
          ? {
              chainlinkAddress: marketData[index].oracleTimestampData.chainlinkAddress,
              updatedAt: marketData[index].oracleTimestampData.updatedAt,
              ageSeconds: marketData[index].oracleTimestampData.ageSeconds,
            }
          : null,
        derived: {
          lltvPct,
          priceShockPct,
          headroomUsd,
          headroomRatioPct,
          utilizationPct,
          availableLiquidityUsd,
          liquidatableBorrowUsd,
          coverageRatio,
          oracleAgeHours,
          oracleAgeDays,
          supplyApyPct,
          borrowApyPct,
        },
      } as V1MarketRiskData;
    });

    const marketsWithScores: V1MarketRiskData[] = await Promise.all(marketsWithScoresPromises);

    const response: V1VaultMarketRiskResponse = {
      vaultAddress: address,
      vaultLiquidity,
      markets: marketsWithScores,
    };

    const responseHeaders = new Headers(rateLimitResult.headers);
    responseHeaders.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');

    return NextResponse.json(response, { headers: responseHeaders });
  } catch (error) {
    const { error: apiError, statusCode } = handleApiError(error);
    return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: statusCode });
  }
}
