'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MarketRiskDetailCard } from '@/components/morpho/MarketRiskDetailCard';
import { MarketOraclePanel } from '@/components/morpho/MarketOraclePanel';
import { useCuratorMarketDetail } from '@/lib/hooks/useCuratorMarkets';
import { morphoMarketHref } from '@/lib/morpho/morpho-app-links';
import { asBlueMarketData } from '@/lib/morpho/blue-market-data';
import { formatPercentage } from '@/lib/format/number';
import { formatLltvPill } from '@/components/morpho/AllocationListView';
import { TokenUsdValue } from '@/components/morpho/TokenUsdValue';
import { resolveTokenDisplayProps } from '@/lib/format/asset-decimals';
import { BASE_CHAIN_ID, CURATOR_MARKET_NETWORKS, parseCuratorMarketChainId } from '@/lib/constants';

function MarketMetric({
  label,
  underlying,
  usd,
  assetSymbol,
  decimals,
  compactUsd = false,
}: {
  label: string;
  underlying: string | null | undefined;
  usd: number | null | undefined;
  assetSymbol: string;
  decimals: number;
  compactUsd?: boolean;
}) {
  const { chainDecimals, displayDecimals } = resolveTokenDisplayProps(assetSymbol, decimals);
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <TokenUsdValue
        underlying={underlying}
        usd={usd}
        assetSymbol={assetSymbol}
        chainDecimals={chainDecimals}
        displayDecimals={displayDecimals}
        compactUsd={compactUsd}
        align="left"
      />
    </div>
  );
}

export default function CuratorBlueMarketPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const marketId = decodeURIComponent(params.id as string);
  const chainId = parseCuratorMarketChainId(searchParams.get('chainId'));

  const { data, isLoading, error } = useCuratorMarketDetail(marketId, chainId);
  const market = data?.market;
  const networkName =
    CURATOR_MARKET_NETWORKS.find((n) => n.chainId === chainId)?.name ?? `Chain ${chainId}`;

  const morphoHref = morphoMarketHref(marketId, chainId);
  const pairLabel = market
    ? `${market.collateralSymbol} / ${market.loanSymbol}`
    : 'Market';
  const headerDescription = `Morpho Blue · ${networkName}`;

  const riskMarket = market
    ? asBlueMarketData({
        id: market.marketId,
        marketId: market.marketId,
        loanAsset: {
          address: market.loanAddress ?? '',
          symbol: market.loanSymbol,
          decimals: market.loanDecimals ?? 18,
        },
        collateralAsset: {
          address: market.collateralAddress ?? '',
          symbol: market.collateralSymbol,
          decimals: market.collateralDecimals ?? 18,
        },
        oracleAddress: market.oracleAddress,
        oracle: null,
        irmAddress: market.irmAddress,
        lltv: market.lltv,
        realizedBadDebt:
          market.realizedBadDebt?.usd != null
            ? { usd: market.realizedBadDebt.usd }
            : null,
        state: {
          sizeUsd: market.sizeUsd,
          totalLiquidityUsd: market.totalLiquidityUsd,
          supplyAssetsUsd: market.supplyAssetsUsd,
          supplyAssets: market.supplyAssets,
          borrowAssetsUsd: market.borrowAssetsUsd,
          borrowAssets: market.borrowAssets,
          collateralAssetsUsd: market.collateralAssetsUsd,
          collateralAssets: market.collateralAssets,
          liquidityAssets: market.liquidityAssets,
          liquidityAssetsUsd: market.liquidityAssetsUsd,
          utilization: market.utilization,
          supplyApy: market.supplyApy,
          borrowApy: market.borrowApy,
        },
        vaultSupplyAssets: null,
        vaultSupplyAssetsUsd: null,
        vaultTotalAssetsUsd: null,
        marketTotalSupplyUsd: market.supplyAssetsUsd,
      })
    : null;

  return (
    <AppShell
      title={
        market && morphoHref ? (
          <a
            href={morphoHref}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors underline decoration-1 underline-offset-4"
          >
            {pairLabel}
          </a>
        ) : (
          pairLabel
        )
      }
      description={
        morphoHref ? (
          <a
            href={morphoHref}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {headerDescription}
          </a>
        ) : (
          headerDescription
        )
      }
      backHref="/markets"
      backLabel="Morpho Markets"
      actions={
        morphoHref ? (
          <Button variant="outline" size="sm" asChild>
            <a href={morphoHref} target="_blank" rel="noopener noreferrer">
              Morpho app
              <ExternalLink className="ml-1 h-4 w-4" />
            </a>
          </Button>
        ) : null
      }
    >
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="pt-6 text-sm text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : 'Failed to load market'}
          </CardContent>
        </Card>
      )}

      {market && riskMarket && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Market overview</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Network</p>
                <p className="font-medium">{networkName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">LLTV</p>
                <p className="font-medium">{formatLltvPill(market.lltv) ?? '—'}</p>
              </div>
              <MarketMetric
                label="Market size"
                underlying={market.supplyAssets}
                usd={market.sizeUsd}
                assetSymbol={market.loanSymbol}
                decimals={market.loanDecimals ?? 18}
              />
              <MarketMetric
                label="Total liquidity"
                underlying={null}
                usd={market.totalLiquidityUsd}
                assetSymbol={market.loanSymbol}
                decimals={market.loanDecimals ?? 18}
                compactUsd
              />
              <MarketMetric
                label="Available liquidity"
                underlying={market.liquidityAssets}
                usd={market.liquidityAssetsUsd}
                assetSymbol={market.loanSymbol}
                decimals={market.loanDecimals ?? 18}
              />
              <MarketMetric
                label="Supply"
                underlying={market.supplyAssets}
                usd={market.supplyAssetsUsd}
                assetSymbol={market.loanSymbol}
                decimals={market.loanDecimals ?? 18}
              />
              <MarketMetric
                label="Borrow"
                underlying={market.borrowAssets}
                usd={market.borrowAssetsUsd}
                assetSymbol={market.loanSymbol}
                decimals={market.loanDecimals ?? 18}
              />
              <MarketMetric
                label="Collateral"
                underlying={market.collateralAssets}
                usd={market.collateralAssetsUsd}
                assetSymbol={market.collateralSymbol}
                decimals={market.collateralDecimals ?? 18}
              />
              <div>
                <p className="text-xs text-slate-500">Utilization</p>
                <p className="font-medium">
                  {market.utilization != null
                    ? formatPercentage(market.utilization * 100)
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Supply APY</p>
                <p className="font-medium">
                  {market.supplyApy != null ? formatPercentage(market.supplyApy * 100) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Borrow APY</p>
                <p className="font-medium">
                  {market.borrowApy != null ? formatPercentage(market.borrowApy * 100) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">6H net supply APY</p>
                <p className="font-medium">
                  {market.avgNetSupplyApy != null
                    ? formatPercentage(market.avgNetSupplyApy * 100)
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Spot net supply APY</p>
                <p className="font-medium">
                  {market.netSupplyApy != null
                    ? formatPercentage(market.netSupplyApy * 100)
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Listed</p>
                <Badge variant={market.listed ? 'default' : 'secondary'}>
                  {market.listed ? 'Listed' : 'Not listed'}
                </Badge>
              </div>
              <MarketMetric
                label="Realized bad debt"
                underlying={market.realizedBadDebt?.underlying}
                usd={market.realizedBadDebt?.usd}
                assetSymbol={market.loanSymbol}
                decimals={market.loanDecimals ?? 18}
              />
              <MarketMetric
                label="Unrealized bad debt"
                underlying={market.unrealizedBadDebt?.underlying}
                usd={market.unrealizedBadDebt?.usd}
                assetSymbol={market.loanSymbol}
                decimals={market.loanDecimals ?? 18}
              />
              <div className="sm:col-span-2 lg:col-span-4">
                <p className="text-xs text-slate-500">Market ID</p>
                <p className="font-mono text-xs break-all text-slate-700 dark:text-slate-300">
                  {market.marketId}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500">Muscadine vault caps</p>
                {market.muscadineVaults.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {market.muscadineVaults.map((v) => (
                      <Button key={v.address} variant="secondary" size="sm" asChild>
                        <Link href={`/vault/${v.address}`}>{v.name}</Link>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No Muscadine vault market cap enabled</p>
                )}
              </div>
            </CardContent>
          </Card>

          {chainId === BASE_CHAIN_ID && (
            <MarketOraclePanel
              collateralSymbol={market.collateralSymbol}
              loanSymbol={market.loanSymbol}
              chainId={chainId}
              oraclePrice={market.oraclePrice}
              oracleTimestampData={market.oracleTimestampData}
            />
          )}

          {chainId !== BASE_CHAIN_ID ? (
            <Card>
              <CardContent className="pt-6 text-sm text-slate-500 dark:text-slate-400">
                Oracle freshness, feed bounds, and IRM utilization targets still read via the{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">Base RPC</span>{' '}
                only. To enable full risk scoring and the oracle panel on{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {networkName}
                </span>
                , add a {networkName} RPC to the website (server client + env).
              </CardContent>
            </Card>
          ) : (
            <MarketRiskDetailCard
              market={riskMarket}
              scores={market.scores}
              oracleTimestampData={market.oracleTimestampData}
              chainId={chainId}
              marketTitleLink="morpho"
            />
          )}
        </div>
      )}
    </AppShell>
  );
}
