/**
 * User-facing ERC-4626 deposit/withdraw for Morpho Vault V2.
 * Multi-step WETH/ETH flows use Morpho Bundler3 + GeneralAdapter1.
 */

import {
  type Address,
  type PublicClient,
  type WalletClient,
  parseUnits,
  formatUnits,
  getAddress,
} from 'viem';
import {
  buildWethVaultNativeDepositBundle,
  buildWethVaultWithdrawToEthBundle,
  executeBundler3Multicall,
  maxSharePriceE27FromQuote,
  minSharePriceE27FromQuote,
} from '@/lib/morpho/bundler3';
import {
  BASE_WETH_ADDRESS,
  ETH_GAS_RESERVE,
  GENERAL_ADAPTER_ADDRESS,
} from '@/lib/constants';
import type { TransactionProgressCallback } from '@/lib/morpho/types/transactions';

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

const ERC4626_ABI = [
  {
    name: 'asset',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'onBehalf', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'previewWithdraw',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'redeem',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'convertToAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'convertToShares',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

export { ERC20_ABI, ERC4626_ABI };

const gasReserveWei = parseUnits(ETH_GAS_RESERVE.toString(), 18);

function emitTransactionPlan(
  onProgress: TransactionProgressCallback | undefined,
  stepLabels: string[]
): void {
  if (!onProgress || stepLabels.length === 0) return;
  onProgress({
    type: 'planned',
    totalSteps: stepLabels.length,
    stepLabels,
  });
}

function parseAmount(amount: string, decimals: number): bigint {
  let sanitizedAmount = amount.trim().replace(/\s+/g, '');
  if (sanitizedAmount.startsWith('.')) {
    sanitizedAmount = '0' + sanitizedAmount;
  }
  if (!/^\d+\.?\d*$/.test(sanitizedAmount)) {
    throw new Error(`Invalid amount format: "${amount}". Expected a decimal number.`);
  }

  const parts = sanitizedAmount.split('.');
  const integerPart = parts[0] || '0';
  const decimalPart = parts[1] || '';

  if (decimals === 0) {
    if (decimalPart && /[1-9]/.test(decimalPart)) {
      throw new Error(`Fractional input not allowed for 0-decimal assets. Received: "${amount}"`);
    }
    return parseUnits(integerPart, 0);
  }

  const truncatedDecimal = decimalPart.slice(0, decimals);
  const paddedDecimal = truncatedDecimal.padEnd(decimals, '0');
  return parseUnits(`${integerPart}.${paddedDecimal}`, decimals);
}

async function ensureApproval(
  publicClient: PublicClient,
  walletClient: WalletClient,
  tokenAddress: Address,
  spenderAddress: Address,
  amount: bigint,
  ownerAddress: Address,
  onProgress?: TransactionProgressCallback,
  stepIndex: number = 0,
  totalSteps: number = 1,
  labels?: { reset?: string; approve?: string }
): Promise<boolean> {
  if (amount === BigInt(0)) return false;

  const resetLabel = labels?.reset ?? 'Reset approval';
  const approveLabel = labels?.approve ?? 'Approve token';

  const allowance = (await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [ownerAddress, spenderAddress],
  })) as bigint;

  if (allowance >= amount) return false;
  if (!walletClient.account) throw new Error('Wallet account not available');

  let needsReset = false;
  if (allowance > BigInt(0) && allowance < amount) {
    needsReset = true;
    onProgress?.({
      type: 'approving',
      stepIndex,
      totalSteps,
      stepLabel: resetLabel,
      contractAddress: tokenAddress,
    });

    const resetHash = await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spenderAddress, BigInt(0)],
      account: walletClient.account,
      chain: walletClient.chain,
    });

    onProgress?.({
      type: 'approving',
      stepIndex,
      totalSteps,
      stepLabel: resetLabel,
      contractAddress: tokenAddress,
      txHash: resetHash,
    });
    await publicClient.waitForTransactionReceipt({ hash: resetHash });
  }

  const approvalStepIndex = needsReset ? stepIndex + 1 : stepIndex;
  onProgress?.({
    type: 'approving',
    stepIndex: approvalStepIndex,
    totalSteps,
    stepLabel: approveLabel,
    contractAddress: tokenAddress,
  });

  const approveHash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spenderAddress, amount],
    account: walletClient.account,
    chain: walletClient.chain,
  });

  onProgress?.({
    type: 'approving',
    stepIndex: approvalStepIndex,
    totalSteps,
    stepLabel: approveLabel,
    contractAddress: tokenAddress,
    txHash: approveHash,
  });

  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  return needsReset;
}

async function executeVaultWithdrawThenUnwrap(
  publicClient: PublicClient,
  walletClient: WalletClient,
  vaultAddress: Address,
  mode: 'withdraw' | 'redeem',
  assetsOrShares: bigint,
  onProgress?: TransactionProgressCallback
): Promise<string> {
  if (!walletClient.account) throw new Error('Wallet account not available');

  const userAddress = walletClient.account.address;
  const normalizedVault = getAddress(vaultAddress);

  const sharesForApproval =
    mode === 'redeem'
      ? assetsOrShares
      : ((await publicClient.readContract({
          address: normalizedVault,
          abi: ERC4626_ABI,
          functionName: 'previewWithdraw',
          args: [assetsOrShares],
        })) as bigint);

  const shareAllowance = (await publicClient.readContract({
    address: normalizedVault,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress, GENERAL_ADAPTER_ADDRESS],
  })) as bigint;

  const needsShareApproval = shareAllowance < sharesForApproval;
  const needsReset =
    needsShareApproval && shareAllowance > BigInt(0) && shareAllowance < sharesForApproval;

  const planLabels: string[] = [];
  if (needsReset) planLabels.push('Reset share approval', 'Approve shares');
  else if (needsShareApproval) planLabels.push('Approve shares');
  planLabels.push(mode === 'withdraw' ? 'Withdraw to ETH' : 'Redeem to ETH');
  emitTransactionPlan(onProgress, planLabels);

  let step = 0;
  const totalSteps = planLabels.length;

  if (needsShareApproval) {
    const didReset = await ensureApproval(
      publicClient,
      walletClient,
      normalizedVault,
      GENERAL_ADAPTER_ADDRESS,
      sharesForApproval,
      userAddress,
      onProgress,
      step,
      totalSteps
    );
    step += didReset ? 2 : 1;
  }

  const calls = buildWethVaultWithdrawToEthBundle({
    vault: normalizedVault,
    user: userAddress,
    mode,
    assetsOrShares,
    minSharePriceE27:
      mode === 'withdraw'
        ? minSharePriceE27FromQuote(assetsOrShares, sharesForApproval)
        : minSharePriceE27FromQuote(
            (await publicClient.readContract({
              address: normalizedVault,
              abi: ERC4626_ABI,
              functionName: 'convertToAssets',
              args: [assetsOrShares],
            })) as bigint,
            assetsOrShares
          ),
  });

  return executeBundler3Multicall(publicClient, walletClient, calls, {
    onProgress,
    stepIndex: step,
    totalSteps,
    stepLabel: planLabels[planLabels.length - 1],
  });
}

export async function depositToVaultV2(
  publicClient: PublicClient,
  walletClient: WalletClient,
  vaultAddress: Address,
  amount: string,
  assetDecimals: number,
  preferredAsset?: 'ETH' | 'WETH' | 'ALL',
  onProgress?: TransactionProgressCallback
): Promise<string> {
  if (!walletClient.account) throw new Error('Wallet not connected');

  const userAddress = walletClient.account.address;
  const normalizedVault = getAddress(vaultAddress);

  const assetAddress = (await publicClient.readContract({
    address: normalizedVault,
    abi: ERC4626_ABI,
    functionName: 'asset',
  })) as Address;

  const isWethVault = assetAddress.toLowerCase() === BASE_WETH_ADDRESS.toLowerCase();
  const amountBigInt = parseAmount(amount, assetDecimals);

  let ethToWrap: bigint = BigInt(0);
  if (isWethVault) {
    const existingWeth = (await publicClient.readContract({
      address: BASE_WETH_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [userAddress],
    })) as bigint;

    const availableEth = await publicClient.getBalance({ address: userAddress });
    const availableEthAfterReserve =
      availableEth > gasReserveWei ? availableEth - gasReserveWei : BigInt(0);
    const assetPreference = preferredAsset || 'ALL';

    if (assetPreference === 'ETH') {
      if (amountBigInt > availableEthAfterReserve) {
        throw new Error(
          `Insufficient ETH balance.\n\nRequested: ${formatUnits(amountBigInt, 18)} ETH\nAvailable: ${formatUnits(availableEthAfterReserve, 18)} ETH`
        );
      }
      ethToWrap = amountBigInt;
    } else if (assetPreference === 'WETH') {
      if (amountBigInt > existingWeth) {
        throw new Error(
          `Insufficient WETH balance.\n\nRequested: ${formatUnits(amountBigInt, 18)} WETH\nAvailable: ${formatUnits(existingWeth, 18)} WETH`
        );
      }
      ethToWrap = BigInt(0);
    } else {
      const totalAvailable = existingWeth + availableEthAfterReserve;
      if (amountBigInt > totalAvailable) {
        throw new Error(
          `Insufficient balance for WETH vault deposit.\n\nRequested: ${formatUnits(amountBigInt, 18)}\nAvailable: ${formatUnits(totalAvailable, 18)}`
        );
      }
      const ethNeeded = amountBigInt > existingWeth ? amountBigInt - existingWeth : BigInt(0);
      ethToWrap = ethNeeded > availableEthAfterReserve ? availableEthAfterReserve : ethNeeded;
    }
  }

  const approvalSpender =
    isWethVault && ethToWrap > BigInt(0) ? GENERAL_ADAPTER_ADDRESS : normalizedVault;
  const wethFromWalletForBundler =
    isWethVault && ethToWrap > BigInt(0)
      ? amountBigInt > ethToWrap
        ? amountBigInt - ethToWrap
        : BigInt(0)
      : BigInt(0);

  const allowance = (await publicClient.readContract({
    address: assetAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress, approvalSpender],
  })) as bigint;

  const useBundlerDeposit = isWethVault && ethToWrap > BigInt(0);
  const needsApproval = useBundlerDeposit
    ? wethFromWalletForBundler > BigInt(0) && allowance < wethFromWalletForBundler
    : allowance < amountBigInt;
  const needsReset =
    needsApproval &&
    allowance > BigInt(0) &&
    allowance < (useBundlerDeposit ? wethFromWalletForBundler : amountBigInt);

  const totalSteps = 1 + (needsApproval ? 1 : 0) + (needsReset ? 1 : 0);
  const planLabels: string[] = [];
  if (needsReset) planLabels.push('Reset approval', 'Approve token');
  else if (needsApproval) planLabels.push('Approve token');
  planLabels.push(useBundlerDeposit ? 'Deposit (wrap ETH)' : 'Deposit');
  emitTransactionPlan(onProgress, planLabels);

  let currentStep = 0;
  if (needsApproval) {
    const didReset = await ensureApproval(
      publicClient,
      walletClient,
      assetAddress,
      approvalSpender,
      useBundlerDeposit ? wethFromWalletForBundler : amountBigInt,
      userAddress,
      onProgress,
      currentStep,
      totalSteps
    );
    currentStep += didReset ? 2 : 1;
  }

  if (useBundlerDeposit) {
    const expectedShares = (await publicClient.readContract({
      address: normalizedVault,
      abi: ERC4626_ABI,
      functionName: 'convertToShares',
      args: [amountBigInt],
    })) as bigint;
    const calls = buildWethVaultNativeDepositBundle({
      vault: normalizedVault,
      user: userAddress,
      ethToWrap,
      wethFromWallet: wethFromWalletForBundler,
      totalAssets: amountBigInt,
      maxSharePriceE27: maxSharePriceE27FromQuote(amountBigInt, expectedShares),
    });
    return executeBundler3Multicall(publicClient, walletClient, calls, {
      value: ethToWrap,
      onProgress,
      stepIndex: currentStep,
      totalSteps,
      stepLabel: 'Deposit (wrap ETH)',
    });
  }

  onProgress?.({
    type: 'confirming',
    stepIndex: currentStep,
    totalSteps,
    stepLabel: 'Deposit',
    txHash: '',
  });

  const depositHash = await walletClient.writeContract({
    address: normalizedVault,
    abi: ERC4626_ABI,
    functionName: 'deposit',
    args: [amountBigInt, userAddress],
    account: walletClient.account,
    chain: walletClient.chain,
  });

  onProgress?.({
    type: 'confirming',
    stepIndex: currentStep,
    totalSteps,
    stepLabel: 'Deposit',
    txHash: depositHash,
  });

  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  return depositHash;
}

export async function withdrawFromVaultV2(
  publicClient: PublicClient,
  walletClient: WalletClient,
  vaultAddress: Address,
  amount: string,
  assetDecimals: number,
  preferredAsset?: 'ETH' | 'WETH',
  onProgress?: TransactionProgressCallback
): Promise<string> {
  if (!walletClient.account) throw new Error('Wallet not connected');

  const userAddress = walletClient.account.address;
  const normalizedVault = getAddress(vaultAddress);

  const assetAddress = (await publicClient.readContract({
    address: normalizedVault,
    abi: ERC4626_ABI,
    functionName: 'asset',
  })) as Address;

  const isWethVault = assetAddress.toLowerCase() === BASE_WETH_ADDRESS.toLowerCase();
  const amountBigInt = parseAmount(amount, assetDecimals);

  const userShares = (await publicClient.readContract({
    address: normalizedVault,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress],
  })) as bigint;

  if (userShares === BigInt(0)) throw new Error('No shares to withdraw');

  const sharesNeeded = (await publicClient.readContract({
    address: normalizedVault,
    abi: ERC4626_ABI,
    functionName: 'previewWithdraw',
    args: [amountBigInt],
  })) as bigint;

  if (sharesNeeded > userShares) {
    const availableAssets = (await publicClient.readContract({
      address: normalizedVault,
      abi: ERC4626_ABI,
      functionName: 'convertToAssets',
      args: [userShares],
    })) as bigint;
    throw new Error(
      `Insufficient balance for vault withdrawal.\n\nRequested: ${formatUnits(amountBigInt, assetDecimals)}\nAvailable: ${formatUnits(availableAssets, assetDecimals)}`
    );
  }

  if (isWethVault && preferredAsset === 'ETH') {
    return executeVaultWithdrawThenUnwrap(
      publicClient,
      walletClient,
      normalizedVault,
      'withdraw',
      amountBigInt,
      onProgress
    );
  }

  emitTransactionPlan(onProgress, ['Withdraw']);
  onProgress?.({
    type: 'confirming',
    stepIndex: 0,
    totalSteps: 1,
    stepLabel: 'Withdraw',
    txHash: '',
  });

  const withdrawHash = await walletClient.writeContract({
    address: normalizedVault,
    abi: ERC4626_ABI,
    functionName: 'withdraw',
    args: [amountBigInt, userAddress, userAddress],
    account: walletClient.account,
    chain: walletClient.chain,
  });

  onProgress?.({
    type: 'confirming',
    stepIndex: 0,
    totalSteps: 1,
    stepLabel: 'Withdraw',
    txHash: withdrawHash,
  });

  await publicClient.waitForTransactionReceipt({ hash: withdrawHash });
  return withdrawHash;
}

export async function redeemFromVaultV2(
  publicClient: PublicClient,
  walletClient: WalletClient,
  vaultAddress: Address,
  _assetDecimals: number,
  preferredAsset?: 'ETH' | 'WETH',
  onProgress?: TransactionProgressCallback
): Promise<string> {
  if (!walletClient.account) throw new Error('Wallet not connected');

  const userAddress = walletClient.account.address;
  const normalizedVault = getAddress(vaultAddress);

  const assetAddress = (await publicClient.readContract({
    address: normalizedVault,
    abi: ERC4626_ABI,
    functionName: 'asset',
  })) as Address;

  const isWethVault = assetAddress.toLowerCase() === BASE_WETH_ADDRESS.toLowerCase();

  const userShares = (await publicClient.readContract({
    address: normalizedVault,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress],
  })) as bigint;

  if (userShares === BigInt(0)) throw new Error('No shares to redeem');

  if (isWethVault && preferredAsset === 'ETH') {
    return executeVaultWithdrawThenUnwrap(
      publicClient,
      walletClient,
      normalizedVault,
      'redeem',
      userShares,
      onProgress
    );
  }

  emitTransactionPlan(onProgress, ['Redeem']);
  onProgress?.({
    type: 'confirming',
    stepIndex: 0,
    totalSteps: 1,
    stepLabel: 'Redeem',
    txHash: '',
  });

  const redeemHash = await walletClient.writeContract({
    address: normalizedVault,
    abi: ERC4626_ABI,
    functionName: 'redeem',
    args: [userShares, userAddress, userAddress],
    account: walletClient.account,
    chain: walletClient.chain,
  });

  onProgress?.({
    type: 'confirming',
    stepIndex: 0,
    totalSteps: 1,
    stepLabel: 'Redeem',
    txHash: redeemHash,
  });

  await publicClient.waitForTransactionReceipt({ hash: redeemHash });
  return redeemHash;
}

/** Resolve vault asset metadata on-chain for pasted / unknown vault addresses. */
export async function readVaultAssetMeta(
  publicClient: PublicClient,
  vaultAddress: Address
): Promise<{
  assetAddress: Address;
  assetSymbol: string;
  assetDecimals: number;
  vaultName: string;
  vaultSymbol: string;
  isWethVault: boolean;
}> {
  const normalizedVault = getAddress(vaultAddress);
  const assetAddress = (await publicClient.readContract({
    address: normalizedVault,
    abi: ERC4626_ABI,
    functionName: 'asset',
  })) as Address;

  const [assetSymbol, assetDecimals, vaultName, vaultSymbol] = await Promise.all([
    publicClient.readContract({
      address: assetAddress,
      abi: ERC20_ABI,
      functionName: 'symbol',
    }) as Promise<string>,
    publicClient.readContract({
      address: assetAddress,
      abi: ERC20_ABI,
      functionName: 'decimals',
    }) as Promise<number>,
    publicClient
      .readContract({
        address: normalizedVault,
        abi: ERC4626_ABI,
        functionName: 'name',
      })
      .catch(() => 'Vault') as Promise<string>,
    publicClient
      .readContract({
        address: normalizedVault,
        abi: ERC4626_ABI,
        functionName: 'symbol',
      })
      .catch(() => 'VAULT') as Promise<string>,
  ]);

  return {
    assetAddress,
    assetSymbol,
    assetDecimals: Number(assetDecimals),
    vaultName,
    vaultSymbol,
    isWethVault: assetAddress.toLowerCase() === BASE_WETH_ADDRESS.toLowerCase(),
  };
}

export async function readWalletAssetBalance(
  publicClient: PublicClient,
  assetAddress: Address,
  owner: Address
): Promise<bigint> {
  return publicClient.readContract({
    address: assetAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [owner],
  }) as Promise<bigint>;
}

export async function readVaultShareBalance(
  publicClient: PublicClient,
  vaultAddress: Address,
  owner: Address
): Promise<bigint> {
  return publicClient.readContract({
    address: getAddress(vaultAddress),
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [owner],
  }) as Promise<bigint>;
}

export async function convertSharesToAssets(
  publicClient: PublicClient,
  vaultAddress: Address,
  shares: bigint
): Promise<bigint> {
  return publicClient.readContract({
    address: getAddress(vaultAddress),
    abi: ERC4626_ABI,
    functionName: 'convertToAssets',
    args: [shares],
  }) as Promise<bigint>;
}
