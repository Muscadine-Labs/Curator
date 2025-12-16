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
  } | null; // null for idle markets
}

export interface V1VaultMarketRiskResponse {
  vaultAddress: string;
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
    const markets = await fetchV1VaultMarkets(address, cfg.chainId);

    // Fetch oracle timestamp data and IRM target utilization for all active markets in parallel
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

    // Compute risk scores for each market (null for idle markets)
    const marketsWithScoresPromises = markets.map(async (market, index) => {
      if (isMarketIdle(market)) {
        return {
          market,
          scores: null,
        };
      }

      const scores = await computeV1MarketRiskScores(
        market,
        marketData[index].oracleTimestampData,
        marketData[index].targetUtilization
      );

      return {
        market,
        scores,
      };
    });

    const marketsWithScores: V1MarketRiskData[] = await Promise.all(marketsWithScoresPromises);

    const response: V1VaultMarketRiskResponse = {
      vaultAddress: address,
      markets: marketsWithScores,
    };

    return NextResponse.json(response);
  } catch (error) {
    const { error: apiError, statusCode } = handleApiError(error);
    return NextResponse.json({ error: apiError.message, code: apiError.code }, { status: statusCode });
  }
}
