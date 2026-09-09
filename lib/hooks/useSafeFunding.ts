'use client';

import { useCallback, useState } from 'react';
import {
  useAccount,
  useChainId,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { erc20Abi, getAddress, type Address, type Hex } from 'viem';
import { BASE_CHAIN_ID } from '@/lib/constants';
import { isNativeToken, type SafeTokenAddress } from '@/lib/safe/tokens';

/**
 * Send assets from the connected wallet into a Safe.
 *
 * This is an ordinary wallet transaction, not a Safe proposal — a Safe needs no
 * signatures to receive. Native ETH goes out as a value transfer; an ERC-20 as
 * a `transfer` to the Safe address.
 */
export function useSafeFunding() {
  const { address: walletAddress, isConnected } = useAccount();
  const activeChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    chainId: BASE_CHAIN_ID,
  });

  const reset = useCallback(() => {
    setTxHash(null);
    setError(null);
    setIsPending(false);
  }, []);

  const fund = useCallback(
    async (options: { safeAddress: Address; token: SafeTokenAddress; amount: bigint }) => {
      if (!isConnected || !walletAddress) {
        throw new Error('Connect your wallet using the button in the top bar.');
      }
      setIsPending(true);
      setError(null);
      try {
        if (activeChainId !== BASE_CHAIN_ID) {
          await switchChainAsync({ chainId: BASE_CHAIN_ID });
        }

        const to = getAddress(options.safeAddress);
        const hash = isNativeToken(options.token)
          ? await sendTransactionAsync({ to, value: options.amount, chainId: BASE_CHAIN_ID })
          : await writeContractAsync({
              address: getAddress(options.token),
              abi: erc20Abi,
              functionName: 'transfer',
              args: [to, options.amount],
              chainId: BASE_CHAIN_ID,
            });

        setTxHash(hash);
        return hash;
      } catch (err) {
        // Kept raw: TxErrorBanner summarises viem dumps and detects rejections.
        setError(err);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [
      activeChainId,
      isConnected,
      sendTransactionAsync,
      switchChainAsync,
      walletAddress,
      writeContractAsync,
    ]
  );

  return { fund, txHash, isPending, isConfirming, isSuccess, error, reset };
}
