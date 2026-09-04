'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import {
  type Address,
  type Hex,
  isHex,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CuratorEmptyText, CuratorTableShell } from '@/components/morpho/CuratorChrome';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { TxErrorBanner } from '@/components/TxErrorBanner';
import { TxPreviewDialog } from '@/components/morpho/TxPreviewDialog';
import { buildUserTxPreview, type TxPreview } from '@/lib/morpho/tx-preview';
import { isBroadcastTxHash, isWalletRejection } from '@/lib/utils/wallet-error';
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
  readErc20Balance,
  readMarketParamsById,
  readOraclePrice,
  readUserMarketPosition,
  type UserMarketPosition,
} from '@/lib/morpho/market-bootstrap';
import type { UserMarketPositionSummary } from '@/lib/morpho/fetch-user-market-positions';
import { formatAllocationEditInputExact } from '@/lib/format/allocation-display';
import {
  AmountMaxInput,
  evaluateAmountInput,
  isNearFullAmount,
} from '@/components/morpho/AmountMaxInput';
import { curatorBlueMarketHref, curatorMarketPositionsHref, morphoMarketHref } from '@/lib/morpho/morpho-app-links';
import { getScanUrlForChain } from '@/lib/constants';
import { CopyButton } from '@/components/CopyButton';

type MarketPositionBoxProps = {
  initialMarketId?: string;
};

export function MarketPositionBox({ initialMarketId }: MarketPositionBoxProps) {
  const { chainId, networkName, isWalletOnSelectedChain, ready } = useCuratorNetwork();
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
  const [loanWalletBal, setLoanWalletBal] = useState<bigint | null>(null);
  const [collWalletBal, setCollWalletBal] = useState<bigint | null>(null);

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPreview, setReviewPreview] = useState<TxPreview | null>(null);
  const pendingReview = useRef<(() => Promise<void>) | null>(null);
  const busyRef = useRef(false);
  const loadRequestId = useRef(0);
  const skipNextPositionRefresh = useRef(false);
  busyRef.current = busy;

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
    const req = loadRequestId.current;
    if (!publicClient || !deployment || !marketId || !owner || !marketParams) {
      if (req !== loadRequestId.current) return;
      setPosition(null);
      setMaxBorrowAssets(null);
      setMaxWithdrawColl(null);
      setLoanWalletBal(null);
      setCollWalletBal(null);
      return;
    }
    try {
      const [pos, loanBal, collBal] = await Promise.all([
        readUserMarketPosition(
          publicClient,
          deployment.morpho,
          marketId,
          owner
        ),
        readErc20Balance(publicClient, marketParams.loanToken, owner),
        readErc20Balance(publicClient, marketParams.collateralToken, owner),
      ]);
      if (req !== loadRequestId.current) return;
      setPosition(pos);
      setLoanWalletBal(loanBal);
      setCollWalletBal(collBal);
      try {
        const oraclePrice = await readOraclePrice(publicClient, marketParams.oracle);
        if (req !== loadRequestId.current) return;
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
        if (req !== loadRequestId.current) return;
        setMaxBorrowAssets(null);
        setMaxWithdrawColl(null);
      }
    } catch {
      if (req !== loadRequestId.current) return;
      setPosition(null);
      setMaxBorrowAssets(null);
      setMaxWithdrawColl(null);
      setLoanWalletBal(null);
      setCollWalletBal(null);
    }
  }, [publicClient, deployment, marketId, owner, marketParams]);

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
    if (busyRef.current) return;
    const req = ++loadRequestId.current;
    setMarketIdInput(id);
    setLoading(true);
    setLoadError(null);
    setSuccess(null);
    setError(null);
    setReviewOpen(false);
    setMaxBorrowAssets(null);
    setMaxWithdrawColl(null);
    setLoanWalletBal(null);
    setCollWalletBal(null);
    try {
      const params = await readMarketParamsById(publicClient, deployment.morpho, id);
      if (req !== loadRequestId.current) return;
      if (!params) {
        setLoadError('No market found for this id on the selected network.');
        setMarketId(null);
        setMarketParams(null);
        setPosition(null);
        setMaxBorrowAssets(null);
        setMaxWithdrawColl(null);
        setLoanWalletBal(null);
        setCollWalletBal(null);
        return;
      }
      const [loan, coll] = await Promise.all([
        lookupErc20TokenMeta(publicClient, params.loanToken),
        lookupErc20TokenMeta(publicClient, params.collateralToken),
      ]);
      if (req !== loadRequestId.current) return;
      if (loan.status !== 'ok' || coll.status !== 'ok') {
        setLoadError('Could not resolve loan/collateral token metadata.');
        setMarketId(null);
        setMarketParams(null);
        setPosition(null);
        setMaxBorrowAssets(null);
        setMaxWithdrawColl(null);
        setLoanWalletBal(null);
        setCollWalletBal(null);
        return;
      }

      let nextPosition: UserMarketPosition | null = null;
      let nextLoanBal: bigint | null = null;
      let nextCollBal: bigint | null = null;
      let nextMaxBorrow: bigint | null = null;
      let nextMaxWithdrawColl: bigint | null = null;

      if (owner) {
        const [pos, loanBal, collBal] = await Promise.all([
          readUserMarketPosition(
            publicClient,
            deployment.morpho,
            id,
            owner
          ),
          readErc20Balance(publicClient, params.loanToken, owner),
          readErc20Balance(publicClient, params.collateralToken, owner),
        ]);
        if (req !== loadRequestId.current) return;
        nextPosition = pos;
        nextLoanBal = loanBal;
        nextCollBal = collBal;
        try {
          const oraclePrice = await readOraclePrice(publicClient, params.oracle);
          if (req !== loadRequestId.current) return;
          nextMaxBorrow = maxBorrowAgainstCollateral({
            collateral: pos.collateral,
            oraclePrice,
            lltv: params.lltv,
            currentDebtAssets: pos.borrowAssetsUp,
          });
          nextMaxWithdrawColl = maxWithdrawableCollateral({
            collateral: pos.collateral,
            debtAssets: pos.borrowAssetsUp,
            oraclePrice,
            lltv: params.lltv,
          });
        } catch {
          nextMaxBorrow = null;
          nextMaxWithdrawColl = null;
        }
      }

      if (req !== loadRequestId.current) return;
      if (owner) skipNextPositionRefresh.current = true;
      setMarketId(id);
      setMarketParams(params);
      setLoanSymbol(loan.token.symbol);
      setLoanDecimals(loan.token.decimals);
      setCollateralSymbol(coll.token.symbol);
      setCollateralDecimals(coll.token.decimals);
      setLltvLabel(formatLltvPercent(params.lltv));
      setSupplyInput('');
      setCollateralInput('');
      setWithdrawInput('');
      setRepayInput('');
      setWithdrawCollInput('');
      setBorrowInput('');
      setPosition(nextPosition);
      setLoanWalletBal(nextLoanBal);
      setCollWalletBal(nextCollBal);
      setMaxBorrowAssets(nextMaxBorrow);
      setMaxWithdrawColl(nextMaxWithdrawColl);
    } catch (err) {
      if (req !== loadRequestId.current) return;
      setLoadError(err instanceof Error ? err.message : 'Failed to load market');
      setMarketId(null);
      setMarketParams(null);
      setPosition(null);
      setMaxBorrowAssets(null);
      setMaxWithdrawColl(null);
      setLoanWalletBal(null);
      setCollWalletBal(null);
    } finally {
      if (req === loadRequestId.current) setLoading(false);
    }
  }, [deployment, publicClient, marketIdInput, networkName, owner]);

  const loadMarketRef = useRef(loadMarket);
  loadMarketRef.current = loadMarket;

  useEffect(() => {
    if (!ready) return;
    if (!initialMarketId?.trim()) return;
    if (!publicClient || !deployment) return;
    void loadMarketRef.current(initialMarketId.trim());
  }, [ready, initialMarketId, publicClient, deployment]);

  useEffect(() => {
    if (!marketId || !owner) return;
    if (skipNextPositionRefresh.current) {
      skipNextPositionRefresh.current = false;
      return;
    }
    void refreshPosition();
  }, [owner, marketId, refreshPosition]);

  const runAction = async (label: string, action: () => Promise<void>) => {
    if (!publicClient || !owner || !deployment || !marketParams || !marketId) return;
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setSuccess(null);
    setTxHash(null);
    setStep(null);
    try {
      await action();
      setSuccess(label);
      setStep(null);
      setSupplyInput('');
      setWithdrawInput('');
      setCollateralInput('');
      setWithdrawCollInput('');
      setBorrowInput('');
      setRepayInput('');
      await refreshPosition();
      void refetchWalletPositions();
      void queryClient.invalidateQueries({ queryKey: ['user-market-positions'] });
    } catch (err) {
      if (isWalletRejection(err)) {
        setError(null);
        setStep(null);
        return;
      }
      setError(err);
      setStep(null);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const openReview = (preview: TxPreview, run: () => Promise<void>) => {
    pendingReview.current = run;
    setReviewPreview(preview);
    setError(null);
    setSuccess(null);
    setTxHash(null);
    setStep(null);
    setReviewOpen(true);
  };

  const confirmReview = async () => {
    if (busyRef.current) return;
    const run = pendingReview.current;
    if (!run) return;
    await run();
  };

  const marketPairLabel = `${collateralSymbol}/${loanSymbol}`;
  const marketReviewDescription = `${networkName} · LLTV ${lltvLabel}`;

  const toggleWalletPosition = (row: UserMarketPositionSummary) => {
    if (busy || reviewOpen) return;
    const id = row.marketId;
    const next = expandedId?.toLowerCase() === id.toLowerCase() ? null : id;
    setExpandedId(next);
    if (next) {
      void loadMarket(next);
    }
  };

  const repayMaxRaw =
    position == null || loanWalletBal == null
      ? null
      : position.borrowAssetsUp < loanWalletBal
        ? position.borrowAssetsUp
        : loanWalletBal;

  const borrowField = useMemo(
    () => evaluateAmountInput(borrowInput, loanDecimals, maxBorrowAssets),
    [borrowInput, loanDecimals, maxBorrowAssets]
  );
  const repayField = useMemo(
    () => evaluateAmountInput(repayInput, loanDecimals, repayMaxRaw),
    [repayInput, loanDecimals, repayMaxRaw]
  );
  const collateralField = useMemo(
    () => evaluateAmountInput(collateralInput, collateralDecimals, collWalletBal),
    [collateralInput, collateralDecimals, collWalletBal]
  );
  const withdrawCollField = useMemo(
    () => evaluateAmountInput(withdrawCollInput, collateralDecimals, maxWithdrawColl),
    [withdrawCollInput, collateralDecimals, maxWithdrawColl]
  );
  const supplyField = useMemo(
    () => evaluateAmountInput(supplyInput, loanDecimals, loanWalletBal),
    [supplyInput, loanDecimals, loanWalletBal]
  );
  const withdrawSupplyField = useMemo(
    () =>
      evaluateAmountInput(withdrawInput, loanDecimals, position?.supplyAssets ?? 0n),
    [withdrawInput, loanDecimals, position?.supplyAssets]
  );

  const onExitBorrow = () => {
    if (!position) return;
    const hasDebtNow = position.borrowShares > 0n;
    const debtLabel = `${formatAllocationEditInputExact(position.borrowAssetsUp, loanSymbol, loanDecimals, true)} ${loanSymbol}`;
    const collLabel = `${formatAllocationEditInputExact(position.collateral, collateralSymbol, collateralDecimals, true)} ${collateralSymbol}`;
    openReview(
      buildUserTxPreview({
        kind: 'exit',
        amount: hasDebtNow ? `${debtLabel} + ${collLabel}` : collLabel,
        targetLabel: marketPairLabel,
        fromLabel: 'Position',
        toLabel: 'Wallet',
        description: marketReviewDescription,
        footnote: hasDebtNow
          ? 'Repays remaining debt by shares, then withdraws all collateral.'
          : 'Withdraws all posted collateral.',
      }),
      () =>
        runAction('Borrow/collateral exited', async () => {
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
        })
    );
  };

  const onRepay = () => {
    const parsed = repayField.raw;
    const walletCoversDebt =
      loanWalletBal != null &&
      position != null &&
      loanWalletBal >= position.borrowAssetsUp;
    const full =
      position != null &&
      position.borrowShares > 0n &&
      isNearFullAmount(parsed, position.borrowAssetsUp) &&
      walletCoversDebt;
    openReview(
      buildUserTxPreview({
        kind: 'repay',
        amount: `${repayInput.trim()} ${loanSymbol}`,
        targetLabel: marketPairLabel,
        fromLabel: 'Wallet',
        toLabel: marketPairLabel,
        description: marketReviewDescription,
        footnote: full
          ? 'Repays remaining debt by shares so no dust remains.'
          : null,
      }),
      () =>
        runAction('Debt repaid', async () => {
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
            assets: full ? null : parsed,
            onStep: setStep,
          });
        })
    );
  };

  const onWithdrawCollateral = () => {
    const parsed = withdrawCollField.raw;
    const full =
      position != null &&
      position.borrowShares === 0n &&
      isNearFullAmount(parsed, position.collateral);
    openReview(
      buildUserTxPreview({
        kind: 'withdraw_collateral',
        amount: `${withdrawCollInput.trim()} ${collateralSymbol}`,
        targetLabel: marketPairLabel,
        fromLabel: 'Position',
        toLabel: 'Wallet',
        description: marketReviewDescription,
        footnote: full ? 'Withdraws all posted collateral.' : null,
      }),
      () =>
        runAction('Collateral withdrawn', async () => {
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
            assets: full ? null : parsed,
            onStep: setStep,
          });
        })
    );
  };

  const onWithdrawSupply = () => {
    const parsed = withdrawSupplyField.raw;
    const full =
      position != null &&
      position.supplyShares > 0n &&
      isNearFullAmount(parsed, position.supplyAssets);
    openReview(
      buildUserTxPreview({
        kind: 'withdraw',
        amount: `${withdrawInput.trim()} ${loanSymbol}`,
        targetLabel: marketPairLabel,
        fromLabel: 'Market supply',
        toLabel: 'Wallet',
        description: marketReviewDescription,
        footnote: full ? 'Exits supply by shares so no dust remains.' : null,
      }),
      () =>
        runAction('Supply withdrawn', async () => {
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
            assets: full ? null : parsed,
            onStep: setStep,
          });
        })
    );
  };

  const onSupply = () => {
    const assets = supplyField.raw;
    openReview(
      buildUserTxPreview({
        kind: 'supply',
        amount: `${supplyInput.trim()} ${loanSymbol}`,
        targetLabel: marketPairLabel,
        fromLabel: 'Wallet',
        toLabel: 'Market supply',
        description: marketReviewDescription,
      }),
      () =>
        runAction('Supply added', async () => {
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
        })
    );
  };

  const onAddCollateral = () => {
    const assets = collateralField.raw;
    openReview(
      buildUserTxPreview({
        kind: 'add_collateral',
        amount: `${collateralInput.trim()} ${collateralSymbol}`,
        targetLabel: marketPairLabel,
        fromLabel: 'Wallet',
        toLabel: 'Position',
        description: marketReviewDescription,
      }),
      () =>
        runAction('Collateral added', async () => {
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
        })
    );
  };

  const onBorrow = () => {
    const assets = borrowField.raw;
    openReview(
      buildUserTxPreview({
        kind: 'borrow',
        amount: `${borrowInput.trim()} ${loanSymbol}`,
        targetLabel: marketPairLabel,
        fromLabel: 'Market',
        toLabel: 'Wallet',
        description: marketReviewDescription,
      }),
      () =>
        runAction('Borrowed', async () => {
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
        })
    );
  };

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
  const walletActionsReady = isWalletOnSelectedChain && !!owner && !busy && !reviewOpen;

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
      <Card>
        <CardHeader>
          <CardTitle>Your positions</CardTitle>
          <CardDescription>
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
            <CuratorEmptyText>
              No Blue market positions for this wallet on {networkName}.
            </CuratorEmptyText>
          ) : (
            <CuratorTableShell>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Market</TableHead>
                    <TableHead>LLTV</TableHead>
                    <TableHead className="text-right">Supply</TableHead>
                    <TableHead className="text-right">Borrow</TableHead>
                    <TableHead className="text-right">Collateral</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {walletPositions.map((row) => {
                    const open = expandedId?.toLowerCase() === row.marketId.toLowerCase();
                    const active =
                      marketId?.toLowerCase() === row.marketId.toLowerCase();
                    const rowMorpho = morphoMarketHref(row.marketId, chainId);
                    const rowCurator = curatorBlueMarketHref(row.marketId, chainId);
                    const rowPositionsHref = curatorMarketPositionsHref(row.marketId, chainId);
                    const showLive = open && active && position != null;
                    return (
                      <Fragment key={row.marketId}>
                          <TableRow key={row.marketId} className="cursor-pointer" onClick={() => toggleWalletPosition(row)}>
                          <TableCell className="w-8 pr-0">
                            {open ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            <span className="inline-flex items-center gap-2">
                              {row.pair}
                              {loading && open ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                              ) : null}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {row.lltvLabel}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.supplyAssets > 0n
                              ? `${formatAllocationEditInputExact(row.supplyAssets, row.loanSymbol, row.loanDecimals, true)} ${row.loanSymbol}`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.borrowAssets > 0n
                              ? `${formatAllocationEditInputExact(row.borrowAssets, row.loanSymbol, row.loanDecimals, true)} ${row.loanSymbol}`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.collateral > 0n
                              ? `${formatAllocationEditInputExact(row.collateral, row.collateralSymbol, row.collateralDecimals, true)} ${row.collateralSymbol}`
                              : '—'}
                          </TableCell>
                        </TableRow>
                        {open ? (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={6}>
                              <div className="space-y-3 py-1">
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
                                  {rowPositionsHref ? (
                                    <span
                                      className="inline-flex items-center gap-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <CopyButton
                                        text={
                                          typeof window !== 'undefined'
                                            ? `${window.location.origin}${rowPositionsHref}`
                                            : rowPositionsHref
                                        }
                                        message="Copied positions link"
                                        title="Copy positions link"
                                      />
                                      <span className="text-muted-foreground">Copy link</span>
                                    </span>
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
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </CuratorTableShell>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Load market</CardTitle>
          <CardDescription>
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
              disabled={loading || !marketIdInput.trim() || busy || reviewOpen}
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
        <Card>
          <CardHeader>
            <CardTitle>Manage {marketPair}</CardTitle>
            <CardDescription>
              Amounts start empty. MAX fills wallet balance, max borrow (LLTV buffer),
              or the position. Full repay / full supply exit uses shares so no dust
              remains.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-border p-3">
                <AmountMaxInput
                  id="mkt-borrow"
                  label={`Borrow ${loanSymbol}`}
                  hint="Against posted collateral, with an LLTV buffer"
                  symbol={loanSymbol}
                  decimals={loanDecimals}
                  value={borrowInput}
                  onChange={setBorrowInput}
                  maxRaw={maxBorrowAssets}
                  disabled={busy || reviewOpen}
                  availableCaption="Borrowable"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  disabled={
                    !walletActionsReady ||
                    !hasCollateral ||
                    !borrowField.positive ||
                    borrowField.exceeds
                  }
                  onClick={onBorrow}
                >
                  Borrow
                </Button>
              </div>

              <div className="space-y-3 rounded-xl border border-border p-3">
                <AmountMaxInput
                  id="mkt-repay"
                  label={`Repay ${loanSymbol}`}
                  hint={
                    hasDebt
                      ? 'MAX uses min(wallet, debt). Full debt repays by shares.'
                      : 'No debt on this market'
                  }
                  symbol={loanSymbol}
                  decimals={loanDecimals}
                  value={repayInput}
                  onChange={setRepayInput}
                  maxRaw={repayMaxRaw}
                  disabled={busy || reviewOpen || !hasDebt}
                  availableCaption="Wallet / owed"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  disabled={
                    !walletActionsReady ||
                    !hasDebt ||
                    !repayField.positive ||
                    repayField.exceeds
                  }
                  onClick={onRepay}
                >
                  Repay
                </Button>
              </div>

              <div className="space-y-4 rounded-xl border border-border p-3">
                <AmountMaxInput
                  id="mkt-coll-add"
                  label={`Add ${collateralSymbol}`}
                  hint="Wallet collateral balance"
                  symbol={collateralSymbol}
                  decimals={collateralDecimals}
                  value={collateralInput}
                  onChange={setCollateralInput}
                  maxRaw={collWalletBal}
                  disabled={busy || reviewOpen}
                  availableCaption="Wallet"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  disabled={
                    !walletActionsReady ||
                    !collateralField.positive ||
                    collateralField.exceeds
                  }
                  onClick={onAddCollateral}
                >
                  Add collateral
                </Button>
                <AmountMaxInput
                  id="mkt-coll-withdraw"
                  label={`Withdraw ${collateralSymbol}`}
                  hint={
                    hasDebt
                      ? 'MAX is the amount that keeps the loan healthy'
                      : 'MAX withdraws all posted collateral'
                  }
                  symbol={collateralSymbol}
                  decimals={collateralDecimals}
                  value={withdrawCollInput}
                  onChange={setWithdrawCollInput}
                  maxRaw={maxWithdrawColl}
                  disabled={busy || reviewOpen || !hasCollateral}
                  availableCaption={hasDebt ? 'Max safe' : 'Posted'}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  disabled={
                    !walletActionsReady ||
                    !hasCollateral ||
                    !withdrawCollField.positive ||
                    withdrawCollField.exceeds
                  }
                  onClick={onWithdrawCollateral}
                >
                  Withdraw collateral
                </Button>
              </div>

              <div className="space-y-4 rounded-xl border border-border p-3">
                <AmountMaxInput
                  id="mkt-supply"
                  label={`Supply ${loanSymbol}`}
                  hint="Wallet loan-token balance"
                  symbol={loanSymbol}
                  decimals={loanDecimals}
                  value={supplyInput}
                  onChange={setSupplyInput}
                  maxRaw={loanWalletBal}
                  disabled={busy || reviewOpen}
                  availableCaption="Wallet"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  disabled={
                    !walletActionsReady ||
                    !supplyField.positive ||
                    supplyField.exceeds
                  }
                  onClick={onSupply}
                >
                  Supply
                </Button>
                <AmountMaxInput
                  id="mkt-withdraw"
                  label={`Withdraw ${loanSymbol} supply`}
                  hint="MAX uses your full supply shares (no dust)"
                  symbol={loanSymbol}
                  decimals={loanDecimals}
                  value={withdrawInput}
                  onChange={setWithdrawInput}
                  maxRaw={position?.supplyAssets ?? 0n}
                  disabled={busy || reviewOpen || !hasSupply}
                  availableCaption="Supplied"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  disabled={
                    !walletActionsReady ||
                    !hasSupply ||
                    !withdrawSupplyField.positive ||
                    withdrawSupplyField.exceeds
                  }
                  onClick={onWithdrawSupply}
                >
                  Withdraw supply
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-foreground">Exit all</p>
                <p className="text-[11px] text-muted-foreground">
                  Repay full debt (by shares), then withdraw all collateral
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={!isWalletOnSelectedChain || !owner || busy || reviewOpen || !hasBorrow}
                onClick={onExitBorrow}
              >
                {!hasBorrow
                  ? 'Nothing to exit'
                  : hasDebt
                    ? 'Repay all & withdraw coll'
                    : 'Withdraw all collateral'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <TxPreviewDialog
        open={reviewOpen}
        preview={reviewPreview}
        onOpenChange={(open) => {
          if (!open) {
            if (busy && isBroadcastTxHash(txHash)) return;
            if (busy) {
              busyRef.current = false;
              setBusy(false);
              setStep(null);
            }
            setReviewOpen(false);
            return;
          }
          setReviewOpen(true);
        }}
        onConfirm={() => confirmReview()}
        isLoading={busy}
        stepLabel={step}
        error={error}
        isSuccess={success != null}
        txHash={txHash}
        txExplorerHref={
          txHash ? `${getScanUrlForChain(chainId)}/tx/${txHash}` : null
        }
      />

      {!reviewOpen && step ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {step}
        </p>
      ) : null}
      {!reviewOpen && error != null ? (
        <TxErrorBanner error={error} onDismiss={() => setError(null)} />
      ) : null}
      {!reviewOpen && success ? (
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
