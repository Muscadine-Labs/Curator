'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Address,
  type Hex,
  isHex,
  parseUnits,
} from 'viem';
import { useAccount, usePublicClient } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
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
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { TxErrorBanner } from '@/components/TxErrorBanner';
import { useVaultWrite } from '@/lib/hooks/useVaultWrite';
import { useUserMarketPositions } from '@/lib/hooks/useUserMarketPositions';
import { useCuratorNetwork } from '@/lib/network/CuratorNetworkContext';
import { getCreateMarketDeployment } from '@/lib/morpho/create-market-deployments';
import { lookupErc20TokenMeta } from '@/lib/morpho/erc20-token-meta';
import { formatLltvPercent } from '@/lib/morpho/blue-create-market';
import {
  executeAddCollateral,
  executeBorrowAssets,
  executeExitBorrowPosition,
  executeRepayDebt,
  executeSupplyAssets,
  executeWithdrawCollateral,
  executeWithdrawSupply,
  maxBorrowAgainstCollateral,
  maxWithdrawableCollateral,
  readMarketParamsById,
  readOraclePrice,
  readUserMarketPosition,
  type UserMarketPosition,
} from '@/lib/morpho/market-bootstrap';
import type { UserMarketPositionSummary } from '@/lib/morpho/fetch-user-market-positions';
import { formatAllocationEditInputExact } from '@/lib/format/allocation-display';
import { curatorBlueMarketHref, morphoMarketHref } from '@/lib/morpho/morpho-app-links';
import { getScanUrlForChain } from '@/lib/constants';
import { cn } from '@/lib/utils';

type MarketPositionBoxProps = {
  initialMarketId?: string;
};

export function MarketPositionBox({ initialMarketId }: MarketPositionBoxProps) {
  const { chainId, networkName, isWalletOnSelectedChain } = useCuratorNetwork();
  const { address: owner, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId });
  const { write, reset } = useVaultWrite({ chainId });
  const queryClient = useQueryClient();
  const {
    data: walletPositions = [],
    isLoading: walletPositionsLoading,
    refetch: refetchWalletPositions,
  } = useUserMarketPositions(owner, chainId);

  const deployment = useMemo(() => {
    try {
      return getCreateMarketDeployment(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const [marketIdInput, setMarketIdInput] = useState(initialMarketId?.trim() ?? '');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(
    initialMarketId?.trim().toLowerCase() ?? null
  );

  const [marketId, setMarketId] = useState<Hex | null>(null);
  const [loanSymbol, setLoanSymbol] = useState('LOAN');
  const [loanDecimals, setLoanDecimals] = useState(18);
  const [collateralSymbol, setCollateralSymbol] = useState('COLL');
  const [collateralDecimals, setCollateralDecimals] = useState(18);
  const [lltvLabel, setLltvLabel] = useState('—');
  const [position, setPosition] = useState<UserMarketPosition | null>(null);
  const [marketParams, setMarketParams] = useState<
    Awaited<ReturnType<typeof readMarketParamsById>>
  >(null);

  const [supplyInput, setSupplyInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');
  const [collateralInput, setCollateralInput] = useState('');
  const [withdrawCollInput, setWithdrawCollInput] = useState('');
  const [borrowInput, setBorrowInput] = useState('');
  const [repayInput, setRepayInput] = useState('');
  const [maxBorrowAssets, setMaxBorrowAssets] = useState<bigint | null>(null);
  const [maxWithdrawColl, setMaxWithdrawColl] = useState<bigint | null>(null);

  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);

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
      return write({
        address: config.address,
        abi: config.abi,
        functionName: config.functionName,
        args: config.args,
      });
    },
    [reset, write]
  );

  const refreshPosition = useCallback(async () => {
    if (!publicClient || !deployment || !marketId || !owner || !marketParams) {
      setPosition(null);
      setMaxBorrowAssets(null);
      setMaxWithdrawColl(null);
      return;
    }
    const pos = await readUserMarketPosition(
      publicClient,
      deployment.morpho,
      marketId,
      owner
    );
    setPosition(pos);
    setWithdrawInput(
      formatAllocationEditInputExact(pos.supplyAssets, loanSymbol, loanDecimals, true)
    );
    setRepayInput(
      formatAllocationEditInputExact(pos.borrowAssetsUp, loanSymbol, loanDecimals, true)
    );
    setWithdrawCollInput(
      formatAllocationEditInputExact(
        pos.collateral,
        collateralSymbol,
        collateralDecimals,
        true
      )
    );
    try {
      const oraclePrice = await readOraclePrice(publicClient, marketParams.oracle);
      setMaxBorrowAssets(
        maxBorrowAgainstCollateral({
          collateral: pos.collateral,
          oraclePrice,
          lltv: marketParams.lltv,
          currentDebtAssets: pos.borrowAssetsUp,
        })
      );
      setMaxWithdrawColl(
        maxWithdrawableCollateral({
          collateral: pos.collateral,
          debtAssets: pos.borrowAssetsUp,
          oraclePrice,
          lltv: marketParams.lltv,
        })
      );
    } catch {
      setMaxBorrowAssets(null);
      setMaxWithdrawColl(null);
    }
  }, [
    publicClient,
    deployment,
    marketId,
    owner,
    marketParams,
    loanSymbol,
    loanDecimals,
    collateralSymbol,
    collateralDecimals,
  ]);

  const loadMarket = useCallback(async (overrideId?: string) => {
    if (!deployment || !publicClient) {
      setLoadError(`Morpho Blue is not configured for ${networkName}.`);
      return;
    }
    const raw = (overrideId ?? marketIdInput).trim();
    if (!isHex(raw) || raw.length !== 66) {
      setLoadError('Enter a 32-byte market id (0x…, 66 chars).');
      return;
    }
    const id = raw as Hex;
    setMarketIdInput(id);
    setLoading(true);
    setLoadError(null);
    setSuccess(null);
    setError(null);
    setMaxBorrowAssets(null);
    setMaxWithdrawColl(null);
    try {
      const params = await readMarketParamsById(publicClient, deployment.morpho, id);
      if (!params) {
        setLoadError('No market found for this id on the selected network.');
        setMarketId(null);
        setMarketParams(null);
        setPosition(null);
        setMaxBorrowAssets(null);
        setMaxWithdrawColl(null);
        return;
      }
      const [loan, coll] = await Promise.all([
        lookupErc20TokenMeta(publicClient, params.loanToken),
        lookupErc20TokenMeta(publicClient, params.collateralToken),
      ]);
      if (loan.status !== 'ok' || coll.status !== 'ok') {
        setLoadError('Could not resolve loan/collateral token metadata.');
        return;
      }
      setMarketId(id);
      setMarketParams(params);
      setLoanSymbol(loan.token.symbol);
      setLoanDecimals(loan.token.decimals);
      setCollateralSymbol(coll.token.symbol);
      setCollateralDecimals(coll.token.decimals);
      setLltvLabel(formatLltvPercent(params.lltv));
      setSupplyInput(
        formatAllocationEditInputExact(
          10n ** BigInt(Math.max(0, loan.token.decimals - 3)),
          loan.token.symbol,
          loan.token.decimals,
          true
        )
      );
      setCollateralInput('0');
      if (owner) {
        const pos = await readUserMarketPosition(
          publicClient,
          deployment.morpho,
          id,
          owner
        );
        setPosition(pos);
        setWithdrawInput(
          formatAllocationEditInputExact(
            pos.supplyAssets,
            loan.token.symbol,
            loan.token.decimals,
            true
          )
        );
        setRepayInput(
          formatAllocationEditInputExact(
            pos.borrowAssetsUp,
            loan.token.symbol,
            loan.token.decimals,
            true
          )
        );
        setWithdrawCollInput(
          formatAllocationEditInputExact(
            pos.collateral,
            coll.token.symbol,
            coll.token.decimals,
            true
          )
        );
        try {
          const oraclePrice = await readOraclePrice(publicClient, params.oracle);
          setMaxBorrowAssets(
            maxBorrowAgainstCollateral({
              collateral: pos.collateral,
              oraclePrice,
              lltv: params.lltv,
              currentDebtAssets: pos.borrowAssetsUp,
            })
          );
          setMaxWithdrawColl(
            maxWithdrawableCollateral({
              collateral: pos.collateral,
              debtAssets: pos.borrowAssetsUp,
              oraclePrice,
              lltv: params.lltv,
            })
          );
        } catch {
          setMaxBorrowAssets(null);
          setMaxWithdrawColl(null);
        }
      } else {
        setPosition(null);
        setMaxBorrowAssets(null);
        setMaxWithdrawColl(null);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load market');
      setMarketId(null);
      setMarketParams(null);
      setPosition(null);
      setMaxBorrowAssets(null);
      setMaxWithdrawColl(null);
    } finally {
      setLoading(false);
    }
  }, [deployment, publicClient, marketIdInput, networkName, owner]);

  const loadMarketRef = useRef(loadMarket);
  loadMarketRef.current = loadMarket;

  useEffect(() => {
    if (!initialMarketId?.trim()) return;
    if (!publicClient || !deployment) return;
    void loadMarketRef.current(initialMarketId.trim());
  }, [initialMarketId, publicClient, deployment]);

  useEffect(() => {
    if (!marketId || !owner) return;
    void refreshPosition();
  }, [owner, marketId, refreshPosition]);

  const runAction = async (label: string, action: () => Promise<void>) => {
    if (!publicClient || !owner || !deployment || !marketParams || !marketId) return;
    setBusy(true);
    setActiveAction(label);
    setError(null);
    setSuccess(null);
    setTxHash(null);
    setStep(null);
    try {
      await action();
      setSuccess(label);
      setStep(null);
      await refreshPosition();
      void refetchWalletPositions();
      void queryClient.invalidateQueries({ queryKey: ['user-market-positions'] });
    } catch (err) {
      setError(err);
      setStep(null);
    } finally {
      setBusy(false);
      setActiveAction(null);
    }
  };

  const toggleWalletPosition = (row: UserMarketPositionSummary) => {
    const id = row.marketId;
    const next = expandedId?.toLowerCase() === id.toLowerCase() ? null : id;
    setExpandedId(next);
    if (next) {
      void loadMarket(next);
    }
  };

  const onExitBorrow = () =>
    void runAction('Borrow/collateral exited', async () => {
      await executeExitBorrowPosition({
        client: publicClient!,
        write: wrapWrite,
        wait: async (hash) => {
          setTxHash(hash);
          return waitReceipt(hash);
        },
        morpho: deployment!.morpho,
        marketId: marketId!,
        marketParams: marketParams!,
        owner: owner!,
        onStep: setStep,
      });
    });

  const onRepay = (all: boolean) =>
    void runAction(all ? 'Debt repaid' : 'Partial repay', async () => {
      const assets = all
        ? null
        : parseUnits(repayInput.trim() || '0', loanDecimals);
      await executeRepayDebt({
        client: publicClient!,
        write: wrapWrite,
        wait: async (hash) => {
          setTxHash(hash);
          return waitReceipt(hash);
        },
        morpho: deployment!.morpho,
        marketId: marketId!,
        marketParams: marketParams!,
        owner: owner!,
        assets,
        onStep: setStep,
      });
    });

  const onWithdrawCollateral = (all: boolean) =>
    void runAction(
      all ? 'Collateral withdrawn' : 'Partial collateral withdrawn',
      async () => {
        const assets = all
          ? null
          : parseUnits(withdrawCollInput.trim() || '0', collateralDecimals);
        await executeWithdrawCollateral({
          client: publicClient!,
          write: wrapWrite,
          wait: async (hash) => {
            setTxHash(hash);
            return waitReceipt(hash);
          },
          morpho: deployment!.morpho,
          marketId: marketId!,
          marketParams: marketParams!,
          owner: owner!,
          assets,
          onStep: setStep,
        });
      }
    );

  const onWithdrawSupply = (all: boolean) =>
    void runAction(all ? 'Supply withdrawn' : 'Partial supply withdrawn', async () => {
      let assets: bigint | null = null;
      if (!all) {
        assets = parseUnits(withdrawInput.trim() || '0', loanDecimals);
      }
      await executeWithdrawSupply({
        client: publicClient!,
        write: wrapWrite,
        wait: async (hash) => {
          setTxHash(hash);
          return waitReceipt(hash);
        },
        morpho: deployment!.morpho,
        marketId: marketId!,
        marketParams: marketParams!,
        owner: owner!,
        assets,
        onStep: setStep,
      });
    });

  const onSupply = () =>
    void runAction('Supply added', async () => {
      const assets = parseUnits(supplyInput.trim() || '0', loanDecimals);
      await executeSupplyAssets({
        client: publicClient!,
        write: wrapWrite,
        wait: async (hash) => {
          setTxHash(hash);
          return waitReceipt(hash);
        },
        morpho: deployment!.morpho,
        marketParams: marketParams!,
        owner: owner!,
        assets,
        onStep: setStep,
      });
    });

  const onAddCollateral = () =>
    void runAction('Collateral added', async () => {
      const assets = parseUnits(collateralInput.trim() || '0', collateralDecimals);
      await executeAddCollateral({
        client: publicClient!,
        write: wrapWrite,
        wait: async (hash) => {
          setTxHash(hash);
          return waitReceipt(hash);
        },
        morpho: deployment!.morpho,
        marketParams: marketParams!,
        owner: owner!,
        assets,
        onStep: setStep,
      });
    });

  const onBorrow = () =>
    void runAction('Borrowed', async () => {
      const assets = parseUnits(borrowInput.trim() || '0', loanDecimals);
      await executeBorrowAssets({
        write: wrapWrite,
        wait: async (hash) => {
          setTxHash(hash);
          return waitReceipt(hash);
        },
        morpho: deployment!.morpho,
        marketParams: marketParams!,
        owner: owner!,
        assets,
        onStep: setStep,
      });
      setBorrowInput('');
    });

  if (!deployment) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Unsupported network</AlertTitle>
        <AlertDescription>
          Blue market positions are not configured for {networkName}. Switch the top-bar
          network.
        </AlertDescription>
      </Alert>
    );
  }

  const hasDebt = position != null && position.borrowShares > 0n;
  const hasCollateral = position != null && position.collateral > 0n;
  const hasBorrow = hasDebt || hasCollateral;
  const hasSupply = position != null && position.supplyShares > 0n;
  const marketPair = `${collateralSymbol}/${loanSymbol}`;
  const curatorMarketHref = marketId ? curatorBlueMarketHref(marketId, chainId) : null;
  const morphoHref = marketId ? morphoMarketHref(marketId, chainId) : null;
  const maxBorrowLabel =
    maxBorrowAssets != null
      ? formatAllocationEditInputExact(maxBorrowAssets, loanSymbol, loanDecimals, true)
      : null;
  const maxWithdrawCollLabel =
    maxWithdrawColl != null
      ? formatAllocationEditInputExact(
          maxWithdrawColl,
          collateralSymbol,
          collateralDecimals,
          true
        )
      : null;
  const debtLabel =
    position != null
      ? formatAllocationEditInputExact(
          position.borrowAssetsUp,
          loanSymbol,
          loanDecimals,
          true
        )
      : null;

  const liveCollateral =
    marketId && position
      ? formatAllocationEditInputExact(
          position.collateral,
          collateralSymbol,
          collateralDecimals,
          true
        )
      : null;
  const liveDebt =
    marketId && position
      ? formatAllocationEditInputExact(
          position.borrowAssetsUp,
          loanSymbol,
          loanDecimals,
          true
        )
      : null;
  const liveSupply =
    marketId && position
      ? formatAllocationEditInputExact(
          position.supplyAssets,
          loanSymbol,
          loanDecimals,
          true
        )
      : null;

  return (
    <div className="space-y-4">
      <Card className="border-border/70">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-base">Your positions</CardTitle>
          <CardDescription className="text-xs">
            Tap a market to expand balances and load it for manage actions below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <div className="flex justify-center py-1">
              <ConnectWalletButton />
            </div>
          ) : walletPositionsLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading positions…
            </p>
          ) : walletPositions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No Blue market positions for this wallet on {networkName}.
            </p>
          ) : (
            <ul className="space-y-2">
              {walletPositions.map((row) => {
                const open = expandedId?.toLowerCase() === row.marketId.toLowerCase();
                const active =
                  marketId?.toLowerCase() === row.marketId.toLowerCase();
                const rowMorpho = morphoMarketHref(row.marketId, chainId);
                const rowCurator = curatorBlueMarketHref(row.marketId, chainId);
                const showLive = open && active && position != null;
                return (
                  <li
                    key={row.marketId}
                    className={cn(
                      'overflow-hidden rounded-lg border border-border/70',
                      open && 'border-border bg-muted/20'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleWalletPosition(row)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                    >
                      {open ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">
                          {row.pair}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          LLTV {row.lltvLabel}
                          {row.borrowAssets > 0n
                            ? ` · debt ${formatAllocationEditInputExact(row.borrowAssets, row.loanSymbol, row.loanDecimals, true)} ${row.loanSymbol}`
                            : ''}
                          {row.collateral > 0n
                            ? ` · coll ${formatAllocationEditInputExact(row.collateral, row.collateralSymbol, row.collateralDecimals, true)} ${row.collateralSymbol}`
                            : ''}
                          {row.supplyAssets > 0n && row.borrowAssets === 0n && row.collateral === 0n
                            ? ` · supply ${formatAllocationEditInputExact(row.supplyAssets, row.loanSymbol, row.loanDecimals, true)} ${row.loanSymbol}`
                            : ''}
                        </span>
                      </span>
                      {loading && open ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                      ) : null}
                    </button>
                    {open ? (
                      <div className="space-y-3 border-t border-border/60 px-3 py-3">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          {rowCurator ? (
                            <a
                              href={rowCurator}
                              className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Market
                            </a>
                          ) : null}
                          {rowMorpho ? (
                            <a
                              href={rowMorpho}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Morpho
                            </a>
                          ) : null}
                          <span className="font-mono text-muted-foreground">
                            {row.marketId.slice(0, 10)}…{row.marketId.slice(-6)}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                          <div>
                            <p className="text-[11px] text-muted-foreground">Collateral</p>
                            <p className="font-medium tabular-nums break-all">
                              {showLive
                                ? `${liveCollateral} ${collateralSymbol}`
                                : `${formatAllocationEditInputExact(row.collateral, row.collateralSymbol, row.collateralDecimals, true)} ${row.collateralSymbol}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">Debt</p>
                            <p className="font-medium tabular-nums break-all">
                              {showLive
                                ? `${liveDebt} ${loanSymbol}`
                                : `${formatAllocationEditInputExact(row.borrowAssets, row.loanSymbol, row.loanDecimals, true)} ${row.loanSymbol}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">Supply</p>
                            <p className="font-medium tabular-nums break-all">
                              {showLive
                                ? `${liveSupply} ${loanSymbol}`
                                : `${formatAllocationEditInputExact(row.supplyAssets, row.loanSymbol, row.loanDecimals, true)} ${row.loanSymbol}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Load market</CardTitle>
          <CardDescription className="text-xs">
            Or paste a market id. Network: {networkName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={marketIdInput}
            onChange={(e) => setMarketIdInput(e.target.value.trim())}
            placeholder="0x… market id"
            spellCheck={false}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void loadMarket()}
              disabled={loading || !marketIdInput.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Loading…
                </>
              ) : (
                'Load'
              )}
            </Button>
          </div>
          {loadError ? (
            <p className="text-xs text-red-600 dark:text-red-400">{loadError}</p>
          ) : null}
          {marketId && marketParams ? (
            <p className="text-xs text-muted-foreground">
              Managing {marketPair} · LLTV {lltvLabel}
              {curatorMarketHref ? (
                <>
                  {' '}
                  ·{' '}
                  <a
                    href={curatorMarketHref}
                    className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                  >
                    Market
                  </a>
                </>
              ) : null}
              {morphoHref ? (
                <>
                  {' '}
                  ·{' '}
                  <a
                    href={morphoHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                  >
                    Morpho
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {marketParams && position ? (
        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Manage {marketPair}</CardTitle>
            <CardDescription className="text-xs">
              Borrow, repay any amount, add/withdraw collateral (partial or max safe), or
              supply. Exit all = full repay + withdraw all collateral.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <p className="text-xs font-medium text-foreground">
                  Borrow ({loanSymbol})
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Against posted collateral
                  {maxBorrowLabel != null ? ` · ~${maxBorrowLabel} available` : ''}
                </p>
                <Input
                  id="mkt-borrow"
                  value={borrowInput}
                  onChange={(e) => setBorrowInput(e.target.value)}
                  className="w-full font-mono text-sm"
                  disabled={busy}
                  placeholder="0"
                />
                <div className="flex flex-wrap gap-2">
                  {maxBorrowLabel != null &&
                  maxBorrowAssets != null &&
                  maxBorrowAssets > 0n ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setBorrowInput(maxBorrowLabel)}
                    >
                      Max
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      !isWalletOnSelectedChain ||
                      !owner ||
                      busy ||
                      !borrowInput.trim() ||
                      !hasCollateral
                    }
                    onClick={onBorrow}
                  >
                    Borrow
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <p className="text-xs font-medium text-foreground">
                  Repay debt ({loanSymbol})
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Partial amount or repay all
                  {debtLabel != null ? ` · ~${debtLabel} owed` : ''}
                </p>
                <Input
                  id="mkt-repay"
                  value={repayInput}
                  onChange={(e) => setRepayInput(e.target.value)}
                  className="w-full font-mono text-sm"
                  disabled={busy}
                  placeholder="0"
                />
                <div className="flex flex-wrap gap-2">
                  {debtLabel != null && hasDebt ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setRepayInput(debtLabel)}
                    >
                      Max
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      !isWalletOnSelectedChain ||
                      !owner ||
                      busy ||
                      !hasDebt ||
                      !repayInput.trim()
                    }
                    onClick={() => onRepay(false)}
                  >
                    Repay
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!isWalletOnSelectedChain || !owner || busy || !hasDebt}
                    onClick={() => onRepay(true)}
                  >
                    Repay all
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <p className="text-xs font-medium text-foreground">
                  Collateral ({collateralSymbol})
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Add more, or withdraw some / max safe
                  {maxWithdrawCollLabel != null
                    ? ` · ~${maxWithdrawCollLabel} withdrawable`
                    : ''}
                </p>
                <Input
                  id="mkt-coll-add"
                  value={collateralInput}
                  onChange={(e) => setCollateralInput(e.target.value)}
                  className="w-full font-mono text-sm"
                  disabled={busy}
                  placeholder="Add amount"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      !isWalletOnSelectedChain ||
                      !owner ||
                      busy ||
                      !collateralInput.trim()
                    }
                    onClick={onAddCollateral}
                  >
                    Add
                  </Button>
                </div>
                <Input
                  id="mkt-coll-withdraw"
                  value={withdrawCollInput}
                  onChange={(e) => setWithdrawCollInput(e.target.value)}
                  className="w-full font-mono text-sm"
                  disabled={busy}
                  placeholder="Withdraw amount"
                />
                <div className="flex flex-wrap gap-2">
                  {maxWithdrawCollLabel != null &&
                  maxWithdrawColl != null &&
                  maxWithdrawColl > 0n ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setWithdrawCollInput(maxWithdrawCollLabel)}
                    >
                      Max safe
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      !isWalletOnSelectedChain ||
                      !owner ||
                      busy ||
                      !hasCollateral ||
                      !withdrawCollInput.trim()
                    }
                    onClick={() => onWithdrawCollateral(false)}
                  >
                    Withdraw
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      !isWalletOnSelectedChain ||
                      !owner ||
                      busy ||
                      !hasCollateral ||
                      hasDebt
                    }
                    title={
                      hasDebt
                        ? 'Repay debt first to withdraw all collateral'
                        : 'Withdraw all collateral'
                    }
                    onClick={() => onWithdrawCollateral(true)}
                  >
                    Withdraw all
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <p className="text-xs font-medium text-foreground">
                  Supply ({loanSymbol})
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Add liquidity or withdraw supplied loan assets
                </p>
                <Input
                  id="mkt-supply"
                  value={supplyInput}
                  onChange={(e) => setSupplyInput(e.target.value)}
                  className="w-full font-mono text-sm"
                  disabled={busy}
                  placeholder="Supply amount"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      !isWalletOnSelectedChain ||
                      !owner ||
                      busy ||
                      !supplyInput.trim()
                    }
                    onClick={onSupply}
                  >
                    Supply
                  </Button>
                </div>
                <Input
                  id="mkt-withdraw"
                  value={withdrawInput}
                  onChange={(e) => setWithdrawInput(e.target.value)}
                  className="w-full font-mono text-sm"
                  disabled={busy}
                  placeholder="Withdraw amount"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      !isWalletOnSelectedChain ||
                      !owner ||
                      busy ||
                      !hasSupply ||
                      !withdrawInput.trim()
                    }
                    onClick={() => onWithdrawSupply(false)}
                  >
                    Withdraw
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!isWalletOnSelectedChain || !owner || busy || !hasSupply}
                    onClick={() => onWithdrawSupply(true)}
                  >
                    All
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-foreground">Exit all</p>
                <p className="text-[11px] text-muted-foreground">
                  Repay full debt (by shares), then withdraw all collateral
                </p>
              </div>
              <TransactionButton
                onClick={onExitBorrow}
                disabled={!isWalletOnSelectedChain || !owner || busy || !hasBorrow}
                isLoading={busy && activeAction === 'Borrow/collateral exited'}
                isSuccess={success === 'Borrow/collateral exited'}
                error={null}
                txHash={
                  success === 'Borrow/collateral exited'
                    ? (txHash ?? undefined)
                    : undefined
                }
                label={
                  !hasBorrow
                    ? 'Nothing to exit'
                    : hasDebt
                      ? 'Repay all & withdraw coll'
                      : 'Withdraw all collateral'
                }
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {step}
        </p>
      ) : null}
      {error != null ? (
        <TxErrorBanner error={error} onDismiss={() => setError(null)} />
      ) : null}
      {success ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {success}
          {txHash ? (
            <a
              href={`${getScanUrlForChain(chainId)}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              tx
            </a>
          ) : null}
        </p>
      ) : null}

      {!isWalletOnSelectedChain && isConnected ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Switch wallet to {networkName} to sign.
        </p>
      ) : null}
    </div>
  );
}
