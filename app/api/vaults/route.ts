import { NextResponse } from 'next/server';
import {
  getAllVaultAddresses,
  getSidebarVaultAddresses,
  getVaultAddressesForBusinessViews,
  getVaultByAddress,
} from '@/lib/config/vaults';
import { BASE_CHAIN_ID, BPS_PER_ONE, getScanUrlForChain, GRAPHQL_FIRST_LIMIT } from '@/lib/constants';
import { handleApiError } from '@/lib/utils/error-handler';
import { createRateLimitMiddleware, RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS } from '@/lib/utils/rate-limit';
import { computeTreasuryStatement } from '@/lib/morpho/compute-treasury-statement';
import {
  aggregateTreasuryRevenueByVault,
  treasuryRevenueAllTimeForVault,
} from '@/lib/morpho/treasury-statement';
import { batchVaultV2ByAddress } from '@/lib/morpho/batch-vault-graphql';
import { fetchAllV2Positions } from '@/lib/morpho/paginate-v2-positions';
import { getAddress } from 'viem';
import { logger } from '@/lib/utils/logger';
import { mergeApiCacheHeaders, API_CACHE_MAX_AGE_MS } from '@/lib/api/response-cache';
import { withServerResponseCache } from '@/lib/api/server-response-cache';
import { unauthorizedUnlessAdmin } from '@/lib/auth/require-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type VaultListGql = {
  address?: string;
  name?: string;
  symbol?: string;
  listed?: boolean;
  asset?: { address?: string; symbol?: string; decimals?: number };
  performanceFee?: number;
  totalAssets?: string | number | null;
  totalAssetsUsd?: number;
  apy?: number;
  avgNetApy?: number;
  idleAssets?: string | number | null;
  liquidity?: string | number | null;
  liquidityUsd?: number | null;
  liquidityAdapter?: { address?: string | null; type?: string | null; __typename?: string | null } | null;
  liquidityData?: {
    __typename?: string | null;
    market?: {
      loanAsset?: { symbol?: string | null } | null;
      collateralAsset?: { symbol?: string | null } | null;
      state?: { utilization?: number | null } | null;
    } | null;
    metaMorpho?: { name?: string | null; symbol?: string | null } | null;
  } | null;
  positions?: { items?: Array<{ user?: { address?: string } | null } | null> | null };
};

const VAULT_LIST_SELECTION = `
  address
  name
  symbol
  listed
  asset { address symbol decimals }
  performanceFee
  totalAssets
  totalAssetsUsd
  apy
  avgNetApy
  idleAssets
  liquidity
  liquidityUsd
  liquidityAdapter {
    __typename
    address
    ... on MetaMorphoAdapter { type }
    ... on MorphoMarketV1Adapter { type }
  }
  liquidityData {
    __typename
    ... on MarketV1LiquidityData {
      market {
        loanAsset { symbol }
        collateralAsset { symbol }
        state { utilization }
      }
    }
    ... on MetaMorphoLiquidityData {
      metaMorpho { name symbol }
    }
  }
  positions(first: ${GRAPHQL_FIRST_LIMIT}) {
    items { user { address } }
  }
`;

function utilizationPercent(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  return raw <= 1 ? raw * 100 : raw;
}

function listLiquidityAdapter(v: VaultListGql): {
  label: string;
  utilizationPercent: number | null;
} | null {
  const data = v.liquidityData;
  if (data?.__typename === 'MarketV1LiquidityData' && data.market) {
    const col = data.market.collateralAsset?.symbol;
    const loan = data.market.loanAsset?.symbol;
    const label =
      col && loan ? `${col} / ${loan}` : col || loan || 'Variable rate market';
    return {
      label,
      utilizationPercent: utilizationPercent(data.market.state?.utilization),
    };
  }
  if (data?.__typename === 'MetaMorphoLiquidityData') {
    const name = data.metaMorpho?.name || data.metaMorpho?.symbol;
    if (name) return { label: name, utilizationPercent: null };
  }
  if (!v.liquidityAdapter?.address) {
    return { label: 'Idle liquidity', utilizationPercent: null };
  }
  return { label: 'Idle liquidity', utilizationPercent: null };
}

export async function GET(request: Request) {
  const denied = await unauthorizedUnlessAdmin(request);
  if (denied) return denied;
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
    const url = new URL(request.url);
    const sidebarOnly = url.searchParams.get('sidebar') === 'true';
    const includeAll = url.searchParams.get('includeAll') === 'true';
    const cacheKey = `vaults-list-${sidebarOnly ? 'sidebar' : includeAll ? 'all' : 'business'}`;

    const merged = await withServerResponseCache(cacheKey, API_CACHE_MAX_AGE_MS, async () => {
      const vaultConfigs = sidebarOnly
        ? getSidebarVaultAddresses()
        : includeAll
          ? getAllVaultAddresses()
          : getVaultAddressesForBusinessViews();
      const addresses = vaultConfigs.map((v) => getAddress(v.address));
      const configuredAddressSet = new Set(addresses.map((a) => a.toLowerCase()));

      const revenueByVaultPromise = computeTreasuryStatement()
        .then((data) => aggregateTreasuryRevenueByVault(data.vaults))
        .catch((error) => {
          logger.warn('Treasury statement failed for vault list revenue', {
            error: error instanceof Error ? error.message : String(error),
          });
          return {} as Record<string, number>;
        });

      const vaultRefs = vaultConfigs.map((v) => ({
        address: v.address,
        chainId: v.chainId ?? BASE_CHAIN_ID,
      }));

      const [gqlMap, revenueByVault] = await Promise.all([
        batchVaultV2ByAddress<VaultListGql>(vaultRefs, VAULT_LIST_SELECTION),
        revenueByVaultPromise,
      ]);

      const v2Vaults = addresses
        .map((address) => gqlMap.get(address.toLowerCase()) ?? null)
        .filter((v): v is VaultListGql => Boolean(v?.address));

      const depositorsByVault: Record<string, Set<string>> = {};
      await Promise.all(
        v2Vaults.map(async (v2Vault) => {
          if (!v2Vault.address) return;
          const addr = v2Vault.address.toLowerCase();
          const set = new Set<string>();
          const first = v2Vault.positions?.items || [];
          for (const pos of first) {
            if (pos?.user?.address) set.add(pos.user.address.toLowerCase());
          }
          if (first.length >= GRAPHQL_FIRST_LIMIT) {
            const rest = await fetchAllV2Positions(
              v2Vault.address,
              getVaultByAddress(v2Vault.address)?.chainId ?? BASE_CHAIN_ID,
              GRAPHQL_FIRST_LIMIT
            );
            for (const pos of rest) {
              if (pos.user?.address) set.add(pos.user.address.toLowerCase());
            }
          }
          depositorsByVault[addr] = set;
        })
      );

      const depositorCounts: Record<string, number> = {};
      for (const [addr, users] of Object.entries(depositorsByVault)) {
        depositorCounts[addr] = users.size;
      }

      const addressToChainId = Object.fromEntries(
        vaultConfigs.map((v) => [v.address.toLowerCase(), v.chainId])
      );

      const getChainId = (addr: string) =>
        addressToChainId[addr.toLowerCase()] ?? BASE_CHAIN_ID;

      const enrichFromConfig = <T extends { address: string }>(row: T) => {
        const cfg = getVaultByAddress(row.address);
        return {
          ...row,
          id: row.address,
          version: cfg?.morphoVersion ?? ('v2' as const),
          listCategory: cfg?.listCategory ?? null,
        };
      };

      const allVaults = v2Vaults.map((v) => {
        const chainId = getChainId(v.address!);
        return enrichFromConfig({
          address: v.address!,
          name: v.name ?? 'Unknown Vault',
          symbol: v.symbol ?? v.asset?.symbol ?? 'UNKNOWN',
          asset: v.asset?.symbol ?? 'UNKNOWN',
          assetDecimals: v.asset?.decimals ?? null,
          chainId,
          scanUrl: `${getScanUrlForChain(chainId)}/address/${v.address}`,
          performanceFeeBps:
            v.performanceFee != null ? Math.round(v.performanceFee * BPS_PER_ONE) : null,
          status: v.listed ? ('active' as const) : ('paused' as const),
          riskTier: 'medium' as const,
          createdAt: null as string | null,
          tvl: v.totalAssetsUsd ?? null,
          totalAssetsUnderlying:
            v.totalAssets != null && v.totalAssets !== ''
              ? String(v.totalAssets)
              : null,
          apy:
            v.apy != null ? v.apy * 100 : v.avgNetApy != null ? v.avgNetApy * 100 : null,
          depositors: depositorCounts[v.address!.toLowerCase()] ?? 0,
          revenueAllTime: treasuryRevenueAllTimeForVault(revenueByVault, v.address!),
          feesAllTime: null,
          lastHarvest: null,
          idleAssetsUnderlying:
            v.idleAssets != null && v.idleAssets !== ''
              ? String(v.idleAssets)
              : null,
          liquidityUnderlying:
            v.liquidity != null && v.liquidity !== ''
              ? String(v.liquidity)
              : null,
          liquidityUsd: v.liquidityUsd ?? null,
          liquidityAdapter: listLiquidityAdapter(v),
        });
      });

      logger.debug('V2 vaults fetched', {
        found: v2Vaults.length,
        queried: addresses.length,
      });

      return allVaults.filter((v) => configuredAddressSet.has(v.address.toLowerCase()));
    });

    return NextResponse.json(merged, {
      headers: mergeApiCacheHeaders(rateLimitResult.headers),
    });
  } catch (err) {
    const { error, statusCode } = handleApiError(err, 'Failed to fetch vaults');
    return NextResponse.json(error, { status: statusCode });
  }
}
