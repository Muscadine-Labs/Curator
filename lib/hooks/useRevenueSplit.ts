import { useQuery } from '@tanstack/react-query';
import { readFeeSplitterData, readPendingToken, readTotalReleased, readReleased } from '@/lib/onchain/contracts';
import { Address } from 'viem';

export interface RevenueSplitData {
  payee1: Address | null;
  payee2: Address | null;
  shares1: bigint | null;
  shares2: bigint | null;
  totalShares: bigint | null;
}

export interface PendingTokenData {
  payee1Pending: bigint | null;
  payee2Pending: bigint | null;
}

// Revenue split hook
export const useRevenueSplit = () => {
  return useQuery<RevenueSplitData>({
    queryKey: ['revenue-split'],
    queryFn: async () => {
      const splitterAddress = (process.env.NEXT_PUBLIC_FEE_SPLITTER as Address) || (
        '0x194DeC45D34040488f355823e1F94C0434304188' as Address
      );
      if (!splitterAddress) {
        throw new Error('Fee splitter address not configured');
      }
      
      return readFeeSplitterData(splitterAddress);
    },
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};

// Pending token hook
export const usePendingToken = (
  tokenAddress: Address | null,
  payeeAddress?: Address | null
) => {
  return useQuery<PendingTokenData>({
    queryKey: ['pending-token', tokenAddress, payeeAddress],
    queryFn: async () => {
      const splitterAddress = (process.env.NEXT_PUBLIC_FEE_SPLITTER as Address) || (
        '0x194DeC45D34040488f355823e1F94C0434304188' as Address
      );
      if (!splitterAddress || !tokenAddress) {
        throw new Error('Splitter or token address not configured');
      }
      
      // If specific payee is provided, only get that payee's pending amount
      if (payeeAddress) {
        const pending = await readPendingToken(splitterAddress, tokenAddress, payeeAddress);
        const revenueSplit = await readFeeSplitterData(splitterAddress);
        
        // Determine which payee this is
        const isPayee1 = payeeAddress.toLowerCase() === revenueSplit.payee1?.toLowerCase();
        
        return {
          payee1Pending: isPayee1 ? pending : null,
          payee2Pending: isPayee1 ? null : pending,
        };
      }
      
      // Otherwise get both payees' pending amounts
      const revenueSplit = await readFeeSplitterData(splitterAddress);
      
      if (!revenueSplit.payee1 || !revenueSplit.payee2) {
        return {
          payee1Pending: null,
          payee2Pending: null,
        };
      }
      
      const [payee1Pending, payee2Pending] = await Promise.all([
        readPendingToken(splitterAddress, tokenAddress, revenueSplit.payee1),
        readPendingToken(splitterAddress, tokenAddress, revenueSplit.payee2),
      ]);
      
      return {
        payee1Pending,
        payee2Pending,
      };
    },
    enabled: !!tokenAddress,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });
};

// Total released hook
export const useTotalReleased = (tokenAddress: Address | null) => {
  return useQuery<bigint | null>({
    queryKey: ['total-released', tokenAddress],
    queryFn: async () => {
      const splitterAddress = (process.env.NEXT_PUBLIC_FEE_SPLITTER as Address) || (
        '0x194DeC45D34040488f355823e1F94C0434304188' as Address
      );
      if (!splitterAddress || !tokenAddress) {
        throw new Error('Splitter or token address not configured');
      }
      return readTotalReleased(splitterAddress, tokenAddress);
    },
    enabled: !!tokenAddress,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
};

// Released hook (for specific account)
export const useReleased = (
  tokenAddress: Address | null,
  accountAddress?: Address | null
) => {
  return useQuery<bigint | null>({
    queryKey: ['released', tokenAddress, accountAddress],
    queryFn: async () => {
      const splitterAddress = (process.env.NEXT_PUBLIC_FEE_SPLITTER as Address) || (
        '0x194DeC45D34040488f355823e1F94C0434304188' as Address
      );
      if (!splitterAddress || !tokenAddress || !accountAddress) {
        throw new Error('Splitter, token, or account address not configured');
      }
      return readReleased(splitterAddress, tokenAddress, accountAddress);
    },
    enabled: !!tokenAddress && !!accountAddress,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
};
