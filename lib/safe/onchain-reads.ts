import { getAddress, type Address } from 'viem';
import { publicClient } from '@/lib/onchain/client';
import { safeAbi } from '@/lib/safe/abis';
import type { SafeOnChainInfo } from '@/lib/safe/types';

export async function readSafeOnChainInfo(safeAddress: Address): Promise<SafeOnChainInfo> {
  const address = getAddress(safeAddress);

  // One multicall instead of four separate eth_calls — this route is hit on
  // every Safe page load and each round trip counts against the RPC quota.
  const [[owners, threshold, nonce, version], ethBalance] = await Promise.all([
    publicClient.multicall({
      contracts: [
        { address, abi: safeAbi, functionName: 'getOwners' },
        { address, abi: safeAbi, functionName: 'getThreshold' },
        { address, abi: safeAbi, functionName: 'nonce' },
        { address, abi: safeAbi, functionName: 'VERSION' },
      ],
      allowFailure: false,
    }),
    publicClient.getBalance({ address }),
  ]);

  return {
    address,
    owners: (owners as Address[]).map((o) => getAddress(o)),
    threshold: Number(threshold),
    nonce: nonce as bigint,
    version: version as string,
    ethBalance,
  };
}

export async function reconcilePendingNonce(
  safeAddress: Address,
  proposalNonce: bigint
): Promise<'valid' | 'stale'> {
  const { nonce } = await readSafeOnChainInfo(safeAddress);
  return proposalNonce < nonce ? 'stale' : 'valid';
}
