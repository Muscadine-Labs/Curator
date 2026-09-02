'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from 'wagmi';
import { getAddress, isAddress, type Address } from 'viem';
import { ArrowDownUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/CopyButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import {
  BASE_CHAIN_ID,
  ETH_GAS_RESERVE,
  getAddressScanUrl,
  getScanUrlForChain,
} from '@/lib/constants';
import { getAllVaultAddresses, getConfiguredVaultDisplayName, getVaultByAddress } from '@/lib/config/vaults';
import { TxErrorBanner } from '@/components/TxErrorBanner';
import { TxPreviewDialog } from '@/components/morpho/TxPreviewDialog';
import { buildUserTxPreview, type TxPreview } from '@/lib/morpho/tx-preview';
import {
  convertSharesToAssets,
  depositToVaultV2,
  readVaultAssetMeta,
  readVaultShareBalance,
  readWalletAssetBalance,
  redeemFromVaultV2,
  withdrawFromVaultV2,
} from '@/lib/morpho/vault-user-transactions';
import type { TransactionProgressStep } from '@/lib/morpho/types/transactions';
import { useUserVaultPositions } from '@/lib/hooks/useUserVaultPositions';
import type { UserVaultPositionSummary } from '@/lib/morpho/fetch-user-vault-positions';
import { useQueryClient } from '@tanstack/react-query';
import { formatAllocationEditInputExact } from '@/lib/format/allocation-display';
import { formatPercentage } from '@/lib/format/number';
import { parseExactAmount, isNearFullAmount } from '@/components/morpho/AmountMaxInput';
import { cn } from '@/lib/utils';
import {
  CuratorEmptyText,
  CuratorSegmented,
  CuratorSegmentedButton,
  CuratorTableShell,
} from '@/components/morpho/CuratorChrome';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Tab = 'deposit' | 'withdraw';
type PreferredAsset = 'ETH' | 'WETH' | 'ALL';
type TxStatus = 'idle' | 'signing' | 'success' | 'error';

type ResolvedVault = {
  address: Address;
  name: string;
  symbol: string;
  assetAddress: Address;
  assetSymbol: string;
  assetDecimals: number;
  isWethVault: boolean;
};

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function isNearFullExit(amount: string, maxAssets: bigint, decimals: number): boolean {
  try {
    return isNearFullAmount(parseExactAmount(amount, decimals), maxAssets);
  } catch {
    return false;
  }
}

export function VaultTransactBox({
  initialVaultAddress,
}: {
  initialVaultAddress?: string;
}) {
  const { address: walletAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: BASE_CHAIN_ID });
  const { data: walletClient } = useWalletClient({ chainId: BASE_CHAIN_ID });
  const queryClient = useQueryClient();
  const {
    data: holdings = [],
    isLoading: holdingsLoading,
    refetch: refetchHoldings,
  } = useUserVaultPositions(walletAddress, BASE_CHAIN_ID);

  const configuredVaults = useMemo(() => getAllVaultAddresses(), []);

  const [selectedPreset, setSelectedPreset] = useState(
    initialVaultAddress?.toLowerCase() ?? configuredVaults[0]?.address.toLowerCase() ?? ''
  );
  const [pastedAddress, setPastedAddress] = useState('');
  const [vault, setVault] = useState<ResolvedVault | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const [tab, setTab] = useState<Tab>('deposit');
  const [amount, setAmount] = useState('');
  const [preferredAsset, setPreferredAsset] = useState<PreferredAsset>('ALL');
  const [walletBalance, setWalletBalance] = useState<bigint>(BigInt(0));
  const [shareAssets, setShareAssets] = useState<bigint>(BigInt(0));
  const [ethBalance, setEthBalance] = useState<bigint>(BigInt(0));
  const [balancesLoading, setBalancesLoading] = useState(false);

  const [status, setStatus] = useState<TxStatus>('idle');
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPreview, setReviewPreview] = useState<TxPreview | null>(null);

  const activeAddress = useMemo(() => {
    const raw = pastedAddress.trim() || selectedPreset;
    if (!raw || !isAddress(raw)) return null;
    try {
      return getAddress(raw);
    } catch {
      return null;
    }
  }, [pastedAddress, selectedPreset]);

  const resolveVault = useCallback(async () => {
    if (!publicClient || !activeAddress) {
      setVault(null);
      return;
    }
    setResolving(true);
    setResolveError(null);
    try {
      const meta = await readVaultAssetMeta(publicClient, activeAddress);
      const cfg = getVaultByAddress(activeAddress);
      setVault({
        address: activeAddress,
        name: meta.vaultName || cfg?.assetSymbol || 'Vault',
        symbol: meta.vaultSymbol,
        assetAddress: meta.assetAddress,
        assetSymbol: meta.assetSymbol || cfg?.assetSymbol || 'ASSET',
        assetDecimals: meta.assetDecimals,
        isWethVault: meta.isWethVault,
      });
      if (meta.isWethVault) {
        setPreferredAsset('ALL');
      }
    } catch (err) {
      setVault(null);
      setResolveError(
        err instanceof Error ? err.message : 'Could not resolve vault at this address'
      );
    } finally {
      setResolving(false);
    }
  }, [publicClient, activeAddress]);

  useEffect(() => {
    void resolveVault();
  }, [resolveVault]);

  const refreshBalances = useCallback(async () => {
    if (!publicClient || !vault || !walletAddress) {
      setWalletBalance(BigInt(0));
      setShareAssets(BigInt(0));
      setEthBalance(BigInt(0));
      return;
    }
    setBalancesLoading(true);
    try {
      const [assetBal, shares, eth] = await Promise.all([
        readWalletAssetBalance(publicClient, vault.assetAddress, walletAddress),
        readVaultShareBalance(publicClient, vault.address, walletAddress),
        publicClient.getBalance({ address: walletAddress }),
      ]);
      const assetsFromShares =
        shares > BigInt(0)
          ? await convertSharesToAssets(publicClient, vault.address, shares)
          : BigInt(0);
      setWalletBalance(assetBal);
      setShareAssets(assetsFromShares);
      setEthBalance(eth);
    } catch {
      setWalletBalance(BigInt(0));
      setShareAssets(BigInt(0));
    } finally {
      setBalancesLoading(false);
    }
  }, [publicClient, vault, walletAddress]);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  const resetStatus = () => {
    setStatus('idle');
    setError(null);
    setTxHash(null);
    setStepLabel(null);
    setReviewOpen(false);
  };

  const selectHolding = (holding: UserVaultPositionSummary) => {
    const configured = configuredVaults.some(
      (v) => v.address.toLowerCase() === holding.address.toLowerCase()
    );
    if (configured) {
      setPastedAddress('');
      setSelectedPreset(holding.address.toLowerCase());
    } else {
      setSelectedPreset('');
      setPastedAddress(holding.address);
    }
    resetStatus();
  };

  const maxDisplay = useMemo(() => {
    if (!vault) return '0';
    if (tab === 'deposit') {
      if (vault.isWethVault && preferredAsset === 'ETH') {
        const reserve = BigInt(Math.floor(ETH_GAS_RESERVE * 1e18));
        const usable = ethBalance > reserve ? ethBalance - reserve : BigInt(0);
        return formatAllocationEditInputExact(usable, 'ETH', 18, true);
      }
      if (vault.isWethVault && preferredAsset === 'ALL') {
        const reserve = BigInt(Math.floor(ETH_GAS_RESERVE * 1e18));
        const usableEth = ethBalance > reserve ? ethBalance - reserve : BigInt(0);
        return formatAllocationEditInputExact(
          walletBalance + usableEth,
          vault.assetSymbol,
          vault.assetDecimals,
          true
        );
      }
      return formatAllocationEditInputExact(
        walletBalance,
        vault.assetSymbol,
        vault.assetDecimals,
        true
      );
    }
    return formatAllocationEditInputExact(
      shareAssets,
      vault.assetSymbol,
      vault.assetDecimals,
      true
    );
  }, [vault, tab, preferredAsset, ethBalance, walletBalance, shareAssets]);

  const onProgress = useCallback((step: TransactionProgressStep) => {
    if (step.type === 'planned') {
      setStepLabel(step.stepLabels[0] ?? 'Starting…');
      return;
    }
    setStepLabel(step.stepLabel);
    if ('txHash' in step && step.txHash) setTxHash(step.txHash);
  }, []);

  const handleSubmit = async () => {
    if (status === 'signing') return;
    if (!publicClient || !walletClient || !vault || !walletAddress || !amount.trim()) return;
    setStatus('signing');
    setError(null);
    setTxHash(null);
    setStepLabel('Preparing…');

    try {
      if (chainId !== BASE_CHAIN_ID) {
        await switchChainAsync({ chainId: BASE_CHAIN_ID });
      }

      let hash: string;
      if (tab === 'deposit') {
        hash = await depositToVaultV2(
          publicClient,
          walletClient,
          vault.address,
          amount.trim(),
          vault.assetDecimals,
          vault.isWethVault ? preferredAsset : undefined,
          onProgress
        );
      } else if (isNearFullExit(amount.trim(), shareAssets, vault.assetDecimals)) {
        hash = await redeemFromVaultV2(
          publicClient,
          walletClient,
          vault.address,
          vault.assetDecimals,
          vault.isWethVault
            ? preferredAsset === 'ETH'
              ? 'ETH'
              : 'WETH'
            : undefined,
          onProgress
        );
      } else {
        hash = await withdrawFromVaultV2(
          publicClient,
          walletClient,
          vault.address,
          amount.trim(),
          vault.assetDecimals,
          vault.isWethVault
            ? preferredAsset === 'ETH'
              ? 'ETH'
              : 'WETH'
            : undefined,
          onProgress
        );
      }

      setTxHash(hash);
      setStatus('success');
      setStepLabel(null);
      setAmount('');
      void refreshBalances();
      void refetchHoldings();
      void queryClient.invalidateQueries({ queryKey: ['user-vault-positions'] });
    } catch (err) {
      setStatus('error');
      setStepLabel(null);
      setError(err);
    }
  };

  const vaultLabel = vault
    ? (() => {
        const cfg = getVaultByAddress(vault.address);
        return cfg ? getConfiguredVaultDisplayName(cfg) : vault.name;
      })()
    : '';

  const openReview = () => {
    if (!vault || !walletAddress || !amount.trim()) return;
    const assetSymbol =
      vault.isWethVault && preferredAsset === 'ETH'
        ? 'ETH'
        : vault.isWethVault && preferredAsset === 'ALL' && tab === 'deposit'
          ? 'ETH + WETH'
          : vault.assetSymbol;
    const walletLabel = `Wallet ${shortAddr(walletAddress)}`;
    const fullRedeem =
      tab === 'withdraw' &&
      isNearFullExit(amount.trim(), shareAssets, vault.assetDecimals);
    const notes: string[] = [];
    if (fullRedeem) notes.push('Full balance uses redeem (all shares).');
    if (vault.isWethVault) {
      if (tab === 'deposit' && preferredAsset === 'ETH') {
        notes.push('Wraps ETH via Bundler3, then deposits WETH.');
      } else if (tab === 'deposit' && preferredAsset === 'ALL') {
        notes.push(
          `Uses ETH then WETH as needed (Bundler3). Keeps ~${ETH_GAS_RESERVE} ETH reserved for gas.`
        );
      } else if (tab === 'withdraw' && preferredAsset === 'ETH') {
        notes.push('Withdraws WETH and unwraps to ETH via Bundler3.');
      }
    }
    setReviewPreview(
      buildUserTxPreview({
        kind: tab === 'deposit' ? 'deposit' : 'withdraw',
        amount: `${amount.trim()} ${assetSymbol}`,
        targetLabel: vaultLabel,
        fromLabel: tab === 'deposit' ? walletLabel : vaultLabel,
        toLabel: tab === 'deposit' ? vaultLabel : walletLabel,
        description: 'Base',
        footnote: notes.length ? notes.join(' ') : null,
      })
    );
    setStatus('idle');
    setError(null);
    setTxHash(null);
    setStepLabel(null);
    setReviewOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Your vault positions</CardTitle>
          <CardDescription>
            Any Morpho vault where this wallet holds shares — Use to deposit or withdraw below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <div className="flex justify-center py-2">
              <ConnectWalletButton />
            </div>
          ) : holdingsLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading positions…
            </p>
          ) : holdings.length === 0 ? (
            <CuratorEmptyText>
              No vault positions found for this wallet on Base.
            </CuratorEmptyText>
          ) : (
            <CuratorTableShell>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vault</TableHead>
                    <TableHead className="text-right">Assets</TableHead>
                    <TableHead className="text-right">APY</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((holding) => {
                    const selected =
                      activeAddress?.toLowerCase() === holding.address.toLowerCase();
                    return (
                      <TableRow
                        key={holding.address}
                        className={selected ? 'bg-muted/50' : undefined}
                      >
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <a
                              href={holding.morphoHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                            >
                              {holding.name}
                            </a>
                            <CopyButton
                              text={holding.address}
                              message="Copied vault address"
                              title="Copy vault address"
                              className="h-7 w-7"
                              iconClassName="h-3.5 w-3.5"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {shortAddr(holding.address)}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAllocationEditInputExact(
                            holding.assets,
                            holding.assetSymbol,
                            holding.assetDecimals,
                            true
                          )}{' '}
                          {holding.assetSymbol}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {holding.apy != null
                            ? `${formatPercentage(holding.apy, 2)} APY`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => selectHolding(holding)}
                          >
                            Use
                          </Button>
                        </TableCell>
                      </TableRow>
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
          <CardTitle className="flex items-center gap-2">
            <ArrowDownUp className="h-4 w-4" />
            Deposit / Withdraw
          </CardTitle>
          <CardDescription>
            Approve and deposit, or withdraw / redeem. WETH vaults can wrap or unwrap ETH via
            Morpho Bundler3.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Configured vault</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={pastedAddress ? '' : selectedPreset}
              onChange={(e) => {
                setPastedAddress('');
                setSelectedPreset(e.target.value);
                resetStatus();
              }}
              disabled={Boolean(pastedAddress.trim())}
            >
              {configuredVaults.map((v) => (
                <option key={v.address} value={v.address.toLowerCase()}>
                  {getConfiguredVaultDisplayName(v)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Or paste any vault address
            </label>
            <Input
              placeholder="0x…"
              value={pastedAddress}
              onChange={(e) => {
                setPastedAddress(e.target.value);
                resetStatus();
              }}
              spellCheck={false}
            />
            {pastedAddress.trim() && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-xs"
                onClick={() => setPastedAddress('')}
              >
                Clear pasted address
              </Button>
            )}
          </div>

          {resolving && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Resolving vault…
            </p>
          )}
          {resolveError && <TxErrorBanner error={resolveError} />}

          {vault && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2">
              <span className="text-sm font-medium tracking-tight">
                {(() => {
                  const cfg = getVaultByAddress(vault.address);
                  return cfg ? getConfiguredVaultDisplayName(cfg) : vault.name;
                })()}
              </span>
              <Badge variant="outline" className="text-xs">
                {vault.symbol}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {vault.assetSymbol}
              </Badge>
              {vault.isWethVault && (
                <Badge variant="outline" className="text-xs">
                  Bundler wrap/unwrap
                </Badge>
              )}
              <a
                href={getAddressScanUrl(BASE_CHAIN_ID, vault.address)}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                {shortAddr(vault.address)}
              </a>
            </div>
          )}

          <CuratorSegmented>
            {(['deposit', 'withdraw'] as const).map((t) => (
              <CuratorSegmentedButton
                key={t}
                active={tab === t}
                onClick={() => {
                  setTab(t);
                  setAmount('');
                  resetStatus();
                  if (vault?.isWethVault) {
                    setPreferredAsset(t === 'deposit' ? 'ALL' : 'WETH');
                  }
                }}
              >
                {t === 'deposit' ? 'Deposit' : 'Withdraw'}
              </CuratorSegmentedButton>
            ))}
          </CuratorSegmented>

          {vault?.isWethVault && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Asset preference</label>
              <div className="flex flex-wrap gap-2">
                {(tab === 'deposit'
                  ? (['ETH', 'WETH', 'ALL'] as const)
                  : (['ETH', 'WETH'] as const)
                ).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPreferredAsset(opt)}
                    className={cn(
                      'rounded-md border px-2.5 py-1.5 text-xs font-medium',
                      preferredAsset === opt
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'border-border text-muted-foreground'
                    )}
                  >
                    {opt === 'ALL' ? 'ETH + WETH' : opt}
                  </button>
                ))}
              </div>
              {tab === 'deposit' && preferredAsset !== 'WETH' && (
                <p className="text-[11px] text-muted-foreground">
                  Keeps ~{ETH_GAS_RESERVE} ETH reserved for gas when wrapping.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">Amount</label>
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                onClick={() => setAmount(maxDisplay)}
                disabled={!vault || balancesLoading}
              >
                Max: {balancesLoading ? '…' : maxDisplay}{' '}
                {vault
                  ? tab === 'deposit' && vault.isWethVault && preferredAsset === 'ETH'
                    ? 'ETH'
                    : vault.assetSymbol
                  : ''}
              </button>
            </div>
            <Input
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={status === 'signing' || reviewOpen}
            />
            {tab === 'withdraw' && vault && (
              <p className="text-[11px] text-muted-foreground">
                Entering your full balance uses redeem (exit all shares).
              </p>
            )}
          </div>

          {!isConnected ? (
            <div className="flex justify-center py-2">
              <ConnectWalletButton />
            </div>
          ) : (
            <Button
              className="w-full"
              disabled={
                !vault ||
                !amount.trim() ||
                status === 'signing' ||
                reviewOpen ||
                resolving ||
                !!resolveError
              }
              onClick={openReview}
            >
              {tab === 'deposit' ? 'Approve & Deposit' : 'Withdraw'}
            </Button>
          )}

          <TxPreviewDialog
            open={reviewOpen}
            preview={reviewPreview}
            onOpenChange={(open) => {
              if (!open && status === 'signing') return;
              setReviewOpen(open);
            }}
            onConfirm={() => handleSubmit()}
            isLoading={status === 'signing'}
            stepLabel={stepLabel}
            error={status === 'error' ? error : null}
            isSuccess={status === 'success'}
            txHash={txHash}
            txExplorerHref={
              txHash ? `${getScanUrlForChain(BASE_CHAIN_ID)}/tx/${txHash}` : null
            }
          />

          {!reviewOpen && status === 'success' && txHash && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
              Transaction confirmed.{' '}
              <a
                href={`${getScanUrlForChain(BASE_CHAIN_ID)}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                View on Basescan
              </a>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-auto px-0"
                onClick={resetStatus}
              >
                New transaction
              </Button>
            </div>
          )}

          {!reviewOpen && status === 'error' && error != null && (
            <TxErrorBanner error={error} onDismiss={resetStatus} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
