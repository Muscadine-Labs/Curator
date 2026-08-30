'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  type Address,
  type Hex,
  formatUnits,
  parseUnits,
} from 'viem';
import { useAccount, usePublicClient } from 'wagmi';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TransactionButton } from '@/components/TransactionButton';
import { useVaultWrite } from '@/lib/hooks/useVaultWrite';
import type { MarketParamsInput } from '@/lib/morpho/blue-create-market';
import {
  DEAD_ADDRESS,
  DEAD_DEPOSIT_SHARES,
  DEFAULT_SEED_UTILIZATION_BPS,
  borrowFromSupply,
  collateralForBorrow,
  deadDepositAssetsNeeded,
  defaultSeedSupplyAssets,
  executeDeadDeposit,
  executeSeedRate,
  readDeadPositionShares,
  readMarketTotals,
  readOraclePrice,
} from '@/lib/morpho/market-bootstrap';
import { formatAllocationEditInputExact } from '@/lib/format/allocation-display';
import { curatorMarketPositionsHref } from '@/lib/morpho/morpho-app-links';

type MarketBootstrapPanelProps = {
  chainId: number;
  networkName: string;
  morpho: Address;
  marketId: Hex;
  marketParams: MarketParamsInput;
  loanSymbol: string;
  loanDecimals: number;
  collateralSymbol: string;
  collateralDecimals: number;
  isWalletOnSelectedChain: boolean;
};

export function MarketBootstrapPanel({
  chainId,
  networkName,
  morpho,
  marketId,
  marketParams,
  loanSymbol,
  loanDecimals,
  collateralSymbol,
  collateralDecimals,
  isWalletOnSelectedChain,
}: MarketBootstrapPanelProps) {
  const { address: owner } = useAccount();
  const publicClient = usePublicClient({ chainId });
  const { write, reset } = useVaultWrite({ chainId });

  const [deadShares, setDeadShares] = useState<bigint | null>(null);
  const [deadAssetsNeeded, setDeadAssetsNeeded] = useState<bigint | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [deadBusy, setDeadBusy] = useState(false);
  const [deadStep, setDeadStep] = useState<string | null>(null);
  const [deadError, setDeadError] = useState<string | null>(null);
  const [deadSuccess, setDeadSuccess] = useState(false);
  const [deadTxHash, setDeadTxHash] = useState<Hex | null>(null);

  const defaultSupplyHuman = formatAllocationEditInputExact(
    defaultSeedSupplyAssets(loanDecimals),
    loanSymbol,
    loanDecimals,
    true
  );
  const [seedSupplyInput, setSeedSupplyInput] = useState(defaultSupplyHuman);
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedStep, setSeedStep] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [seedTxHash, setSeedTxHash] = useState<Hex | null>(null);
  const [seedCollateralPreview, setSeedCollateralPreview] = useState<bigint | null>(
    null
  );

  const refreshStatus = useCallback(async () => {
    if (!publicClient) return;
    setStatusLoading(true);
    setStatusError(null);
    try {
      const [shares, totals] = await Promise.all([
        readDeadPositionShares(publicClient, morpho, marketId),
        readMarketTotals(publicClient, morpho, marketId),
      ]);
      setDeadShares(shares);
      setDeadAssetsNeeded(
        shares >= DEAD_DEPOSIT_SHARES ? 0n : deadDepositAssetsNeeded(totals)
      );
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to load market status');
    } finally {
      setStatusLoading(false);
    }
  }, [publicClient, morpho, marketId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const seedPlan = useMemo(() => {
    try {
      const supply = parseUnits(seedSupplyInput.trim() || '0', loanDecimals);
      const borrow = borrowFromSupply(supply, DEFAULT_SEED_UTILIZATION_BPS);
      return { supply, borrow, error: null as string | null };
    } catch {
      return { supply: 0n, borrow: 0n, error: 'Invalid seed supply amount' };
    }
  }, [seedSupplyInput, loanDecimals]);

  useEffect(() => {
    if (!publicClient || seedPlan.borrow <= 0n || seedPlan.error) {
      setSeedCollateralPreview(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const price = await readOraclePrice(publicClient, marketParams.oracle);
        const coll = collateralForBorrow({
          borrowAssets: seedPlan.borrow,
          oraclePrice: price,
          lltv: marketParams.lltv,
        });
        if (!cancelled) setSeedCollateralPreview(coll);
      } catch {
        if (!cancelled) setSeedCollateralPreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient, marketParams.oracle, marketParams.lltv, seedPlan.borrow, seedPlan.error]);

  const waitReceipt = useCallback(
    async (hash: Hex) => {
      if (!publicClient) throw new Error('RPC client not ready');
      return publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    },
    [publicClient]
  );

  const wrapWrite = useCallback(
    async (config: {
      address: Address;
      abi: readonly unknown[];
      functionName: string;
      args: readonly unknown[];
    }) => {
      reset();
      const hash = await write({
        address: config.address,
        abi: config.abi,
        functionName: config.functionName,
        args: config.args,
      });
      return hash;
    },
    [reset, write]
  );

  const deadDone =
    deadSuccess || (deadShares != null && deadShares >= DEAD_DEPOSIT_SHARES);

  const handleDeadDeposit = async () => {
    if (!publicClient || !owner) return;
    setDeadBusy(true);
    setDeadError(null);
    setDeadSuccess(false);
    setDeadTxHash(null);
    setDeadStep(null);
    try {
      await executeDeadDeposit({
        client: publicClient,
        write: wrapWrite,
        wait: async (hash) => {
          setDeadTxHash(hash);
          return waitReceipt(hash);
        },
        morpho,
        marketId,
        marketParams,
        owner,
        onStep: setDeadStep,
      });
      setDeadSuccess(true);
      setDeadStep(null);
      await refreshStatus();
    } catch (err) {
      setDeadError(err instanceof Error ? err.message : 'Dead deposit failed');
      setDeadStep(null);
    } finally {
      setDeadBusy(false);
    }
  };

  const handleSeedRate = async () => {
    if (!publicClient || !owner) return;
    if (seedPlan.error || seedPlan.supply <= 0n || seedPlan.borrow <= 0n) {
      setSeedError(seedPlan.error ?? 'Enter a valid seed supply');
      return;
    }
    setSeedBusy(true);
    setSeedError(null);
    setSeedSuccess(false);
    setSeedTxHash(null);
    setSeedStep(null);
    try {
      await executeSeedRate({
        client: publicClient,
        write: wrapWrite,
        wait: async (hash) => {
          setSeedTxHash(hash);
          return waitReceipt(hash);
        },
        morpho,
        marketParams,
        owner,
        supplyAssets: seedPlan.supply,
        borrowAssets: seedPlan.borrow,
        onStep: setSeedStep,
      });
      setSeedSuccess(true);
      setSeedStep(null);
      await refreshStatus();
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : 'Seed rate failed');
      setSeedStep(null);
    } finally {
      setSeedBusy(false);
    }
  };

  const utilPct = Number(DEFAULT_SEED_UTILIZATION_BPS) / 100;

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Stay on this page</AlertTitle>
        <AlertDescription>
          After createMarket, run dead deposit (required) then optional rate seed. Both
          use your connected wallet on {networkName} — no navigation needed.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Dead deposit
            {statusLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </CardTitle>
          <CardDescription>
            Supply exactly 1e9 shares to {DEAD_ADDRESS.slice(0, 6)}…dEaD so the market
            cannot be inflation-attacked. Assets needed scale with current share price
            (empty market ≈ 1000 raw loan units).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {statusError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{statusError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Dead shares:{' '}
              <span className="font-mono text-foreground">
                {deadShares != null ? deadShares.toString() : '—'}
              </span>
              {deadAssetsNeeded != null && deadAssetsNeeded > 0n ? (
                <>
                  {' '}
                  · needs ~
                  {formatUnits(deadAssetsNeeded, loanDecimals)} {loanSymbol}
                </>
              ) : null}
            </p>
          )}
          {deadError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{deadError}</p>
          ) : null}
          {deadStep ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {deadStep}
            </p>
          ) : null}
          <TransactionButton
            onClick={() => void handleDeadDeposit()}
            disabled={!isWalletOnSelectedChain || !owner || deadDone || deadBusy || seedBusy}
            isLoading={deadBusy}
            isSuccess={deadDone}
            error={null}
            txHash={deadTxHash ?? undefined}
            label={deadDone ? 'Dead deposit complete' : 'Run dead deposit'}
          />
          {deadDone ? (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Market protected with {DEAD_DEPOSIT_SHARES.toString()} shares on dead
              address.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seed rate (optional)</CardTitle>
          <CardDescription>
            Supply loan liquidity and borrow {utilPct}% of it (AdaptiveCurve target) so
            rates do not decay to ~0% while the market sits unused. Requires loan +
            collateral token balances.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label htmlFor="seedSupply" className="text-sm font-medium">
              Seed supply ({loanSymbol})
            </label>
            <Input
              id="seedSupply"
              value={seedSupplyInput}
              onChange={(e) => setSeedSupplyInput(e.target.value)}
              spellCheck={false}
              className="font-mono text-sm"
              disabled={seedBusy}
            />
            <p className="text-xs text-muted-foreground">
              Borrow ≈{' '}
              {seedPlan.borrow > 0n
                ? `${formatUnits(seedPlan.borrow, loanDecimals)} ${loanSymbol}`
                : '—'}{' '}
              ({utilPct}% util)
              {seedCollateralPreview != null ? (
                <>
                  {' '}
                  · collateral ≈{' '}
                  {formatUnits(seedCollateralPreview, collateralDecimals)}{' '}
                  {collateralSymbol}
                </>
              ) : null}
            </p>
          </div>
          {seedError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{seedError}</p>
          ) : null}
          {seedStep ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {seedStep}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <TransactionButton
              onClick={() => void handleSeedRate()}
              disabled={
                !isWalletOnSelectedChain ||
                !owner ||
                seedBusy ||
                deadBusy ||
                !!seedPlan.error ||
                seedPlan.supply <= 0n
              }
              isLoading={seedBusy}
              isSuccess={seedSuccess}
              error={null}
              txHash={seedTxHash ?? undefined}
              label={seedSuccess ? 'Seed again' : 'Seed rate'}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={seedBusy}
              onClick={() =>
                setSeedSupplyInput(
                  formatAllocationEditInputExact(
                    defaultSeedSupplyAssets(loanDecimals),
                    loanSymbol,
                    loanDecimals,
                    true
                  )
                )
              }
            >
              Reset default
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Later: manage / exit</CardTitle>
          <CardDescription className="text-xs">
            Dead deposit stays forever. To repay the seed borrow, withdraw collateral, or
            add/withdraw supply, open Market Positions anytime.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link
              href={curatorMarketPositionsHref(marketId, chainId) ?? '/markets/positions'}
              className="inline-flex items-center gap-2"
            >
              Open position manager
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
