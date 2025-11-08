import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { mergeConfig } from '@/lib/morpho/config';
import { getMorphoMarketRatings } from '@/lib/morpho/service';
import { RatingBadge } from '@/components/morpho/RatingBadge';
import { MetricCard } from '@/components/morpho/MetricCard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCompactUSD, formatPercentage } from '@/lib/format/number';

type MarketDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: MarketDetailPageProps) {
  const config = mergeConfig();
  const { id } = await params;
  const [market] = await getMorphoMarketRatings({ marketId: id });
  if (!market) {
    return {
      title: 'Market Not Found | Muscadine Curator',
    };
  }

  return {
    title: `${market.symbol} · Curator Risk Rating | Muscadine Curator`,
    description: `Curator risk breakdown for Morpho market ${market.id}. Weighted score derived from utilization, rate alignment, stress testing, withdrawal liquidity, and liquidation capacity.`,
    openGraph: {
      title: `${market.symbol} · Curator Risk Rating`,
      description: `Score: ${market.rating}. Utilization ${formatPercentage(
        market.utilization * 100,
        2
      )}. Stress coverage ${
        market.stressExposureScore >= 0.8 ? 'robust' : 'needs review'
      }.`,
      url: `/markets/${id}`,
    },
    other: {
      'muscadine:curator:utilizationCeiling': config.utilizationCeiling.toString(),
    },
  };
}

export default async function MarketDetailPage({ params }: MarketDetailPageProps) {
  const config = mergeConfig();
  const { id } = await params;
  const [market] = await getMorphoMarketRatings({ marketId: id });

  if (!market) {
    notFound();
  }

  const utilizationPct = market.utilization * 100;
  const utilizationCeilingPct = config.utilizationCeiling * 100;
  const benchmarkRate = market.benchmarkSupplyRate ?? config.fallbackBenchmarkRate;
  const tolerancePct = config.rateAlignmentEps * 100;
  const rateDiffPct = Math.abs((market.supplyRate ?? 0) - benchmarkRate) * 100;
  const benchmarkRateLabel = (benchmarkRate * 100).toFixed(2);
  const insolvencyPct = market.insolvencyPctOfTvl * 100;

  const utilizationTone =
    utilizationPct <= utilizationCeilingPct ? 'positive' : utilizationPct <= utilizationCeilingPct + 5 ? 'warning' : 'negative';
  const rateTone =
    rateDiffPct <= config.rateAlignmentEps * 100
      ? 'positive'
      : rateDiffPct <= config.rateAlignmentEps * 200
      ? 'warning'
      : 'negative';
  const stressTone =
    market.stressExposureScore >= 0.7 ? 'positive' : market.stressExposureScore >= 0.4 ? 'warning' : 'negative';
  const withdrawalTone =
    market.withdrawalLiquidityScore >= 0.9
      ? 'positive'
      : market.withdrawalLiquidityScore >= 0.6
      ? 'warning'
      : 'negative';
  const liquidationTone =
    market.liquidationCapacityScore >= 0.9
      ? 'positive'
      : market.liquidationCapacityScore >= 0.6
      ? 'warning'
      : 'negative';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/vaults"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to vaults
            </Link>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {market.symbol} · Morpho Market
              </h1>
              <p className="text-muted-foreground mt-1 font-mono text-xs">
                {market.id}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">
                Curator Risk Rating
              </CardTitle>
              <CardDescription>
                Weighted composite score grounded in Gauntlet vault curation and Steakhouse upstream risk governance best practices.
              </CardDescription>
            </div>
            <RatingBadge rating={market.rating} className="text-base" />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Badge variant="outline" className="justify-center">
              Utilization Score · {(market.utilizationScore * 100).toFixed(0)}
            </Badge>
            <Badge variant="outline" className="justify-center">
              Rate Alignment Score · {(market.rateAlignmentScore * 100).toFixed(0)}
            </Badge>
            <Badge variant="outline" className="justify-center">
              Stress Coverage Score · {(market.stressExposureScore * 100).toFixed(0)}
            </Badge>
            <Badge variant="outline" className="justify-center">
              Liquidity Score · {(market.withdrawalLiquidityScore * 100).toFixed(0)}
            </Badge>
          </CardContent>
        </Card>

        <section>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Real-Time Utilization"
              value={formatPercentage(utilizationPct, 2)}
              description={`Ceiling target: ${formatPercentage(utilizationCeilingPct, 2)}. Persistent breaches over ${config.utilizationBufferHours}h trigger curator alerts.`}
              helper="Derived from live Morpho supply vs borrow balances."
              tone={utilizationTone}
            />
            <MetricCard
              title="Rate Alignment Δ"
              value={`${rateDiffPct.toFixed(2)}%`}
              description={`Benchmark: ${(benchmarkRate * 100).toFixed(2)}%. Alignment tolerance: ${tolerancePct.toFixed(2)}%.`}
              helper="Deviation highlights liquidity migration risk vs. peer markets (per Gauntlet market-rate diagnostics)."
              tone={rateTone}
            />
            <MetricCard
              title="Stress Insolvency at Tail Event"
              value={formatCompactUSD(market.potentialInsolvencyUsd)}
              description={`Exposure equals ${insolvencyPct.toFixed(3)}% of TVL after ${(
                config.priceStressPct * 100
              ).toFixed(0)}% price and ${(config.liquidityStressPct * 100).toFixed(0)}% liquidity stress.`}
              helper="Steakhouse upstream playbook emphasises automated rebalancing before insolvency crosses 5 bps of TVL."
              tone={stressTone}
            />
            <MetricCard
              title="Withdrawal Liquidity Coverage"
              value={`${(market.availableLiquidity / Math.max(market.requiredLiquidity, 1) * 100).toFixed(1)}%`}
              description={`Available buffer: ${formatCompactUSD(
                market.availableLiquidity
              )} vs required ${formatCompactUSD(market.requiredLiquidity)} (${(
                config.withdrawalLiquidityMinPct * 100
              ).toFixed(0)}% of TVL).`}
              helper="Ensures 24/7 exit liquidity for allocators; guards against utilization >90% stuck states."
              tone={withdrawalTone}
            />
            <MetricCard
              title="Liquidation Capacity Post-Stress"
              value={`${(market.liquidatorCapacityPostStress / Math.max(market.potentialInsolvencyUsd, 1) * 100).toFixed(1)}%`}
              description={`Liquidator inventory after stress: ${formatCompactUSD(
                market.liquidatorCapacityPostStress
              )}. Underwater debt to clear: ${formatCompactUSD(market.potentialInsolvencyUsd)}.`}
              helper="Gauntlet guidance: >=100% coverage protects automated deleveraging loops."
              tone={liquidationTone}
            />
            <MetricCard
              title="Borrow Rate vs Supply Rate"
              value={`${formatPercentage((market.borrowRate ?? 0) * 100, 2)} / ${formatPercentage(
                (market.supplyRate ?? 0) * 100,
                2
              )}`}
              description="Healthy spread supports liquidity incentives without excessive borrower strain."
              helper="Track lending spread drift to anticipate rate realignment triggers."
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Playbook References</CardTitle>
              <CardDescription>
                Operational guardrails validated against industry risk frameworks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Steakhouse upstream governance.</span>{' '}
                The vault follows the Prime mandate—focus on liquid collateral, conservative LLTVs,
                and automated reallocation triggers aligned with{' '}
                <Link
                  href="https://www.steakhouse.financial/docs/risk-management"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-foreground underline decoration-dotted"
                >
                  Steakhouse’s risk management framework
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                .
              </p>
              <p>
                <span className="font-semibold text-foreground">Gauntlet curation diagnostics.</span>{' '}
                Utilization limits, rate sanity checks, and liquidation runway mirror the guidance
                outlined in{' '}
                <Link
                  href="https://vaultbook.gauntlet.xyz/vaults/morpho-vaults/vault-curation-considerations-a-deeper-dive"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-foreground underline decoration-dotted"
                >
                  Gauntlet’s vault curation considerations
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                .
              </p>
              <p>
                <span className="font-semibold text-foreground">Next steps.</span> Integrate persistent
                utilization monitoring (48h windows) and external benchmark feeds (Aave/Compound) to
                tighten rate alignment scoring.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Market Snapshot</CardTitle>
              <CardDescription>
                Key liquidity indicators sourced directly from the Morpho GraphQL API.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <SnapshotRow label="Total Supply (USD)" value={formatCompactUSD(market.raw.state?.supplyAssetsUsd ?? 0)} />
              <SnapshotRow label="Total Borrow (USD)" value={formatCompactUSD(market.raw.state?.borrowAssetsUsd ?? 0)} />
              <SnapshotRow
                label="Available Liquidity"
                value={formatCompactUSD(market.availableLiquidity)}
              />
              <SnapshotRow
                label="TVL"
                value={formatCompactUSD(market.raw.state?.sizeUsd ?? (market.availableLiquidity + market.potentialInsolvencyUsd))}
              />
              <SnapshotRow
                label="Underlying Asset"
                value={market.symbol ?? 'Unknown'}
              />
              <SnapshotRow
                label="Benchmark Supply Rate"
                value={`${benchmarkRateLabel}%`}
              />
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-border/60 px-4 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

