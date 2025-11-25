import { useQuery } from '@tanstack/react-query';
import { readFeeSplitterData, readPendingToken, readTotalReleased, readReleased } from '@/lib/onchain/contracts';
import { Address } from 'viem';
import { getFeeSplitterForVault, getAllFeeSplitters, FEE_SPLITTER_V1, FEE_SPLITTER_V2 } from '@/lib/config/fee-splitters';
import { QUERY_STALE_TIME_MEDIUM, QUERY_STALE_TIME_SHORT, QUERY_REFETCH_INTERVAL_MEDIUM, QUERY_REFETCH_INTERVAL_SHORT } from '@/lib/constants';

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

export interface FeeSplitterWithData extends RevenueSplitData {
  address: Address;
  name: string;
}

function getFeeSplitterAddress(vaultAddress?: Address): Address {
  // If vault address is provided, get the appropriate splitter
  if (vaultAddress) {
    const splitter = getFeeSplitterForVault(vaultAddress);
    if (splitter) return splitter;
  }
  
  // Otherwise use environment variable or default
  const envAddress = process.env.NEXT_PUBLIC_FEE_SPLITTER;
  return (envAddress ? envAddress : FEE_SPLITTER_V1) as Address;
}

// Revenue split hook (for a specific splitter or default)
export const useRevenueSplit = (splitterAddress?: Address, vaultAddress?: Address) => {
  return useQuery<RevenueSplitData>({
    queryKey: ['revenue-split', splitterAddress || vaultAddress],
    queryFn: async () => {
      const address = splitterAddress || getFeeSplitterAddress(vaultAddress);
      return readFeeSplitterData(address);
    },
    enabled: true,
    staleTime: QUERY_STALE_TIME_MEDIUM,
    refetchInterval: QUERY_REFETCH_INTERVAL_MEDIUM,
  });
};

// All fee splitters hook
export const useAllFeeSplitters = () => {
  return useQuery<FeeSplitterWithData[]>({
    queryKey: ['all-fee-splitters'],
    queryFn: async () => {
      const splitters = getAllFeeSplitters();
      const results = await Promise.all(
        splitters.map(async (address) => {
          const data = await readFeeSplitterData(address);
          return {
            ...data,
            address,
            name: address === FEE_SPLITTER_V1 ? 'Fee Splitter V1' : 
                  address === FEE_SPLITTER_V2 ? 'Fee Splitter V2' : 
                  'Fee Splitter',
          };
        })
      );
      return results;
    },
    enabled: true,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

// Pending token hook
export const usePendingToken = (
  tokenAddress: Address | null,
  payeeAddress?: Address | null,
  splitterAddress?: Address,
  vaultAddress?: Address
) => {
  return useQuery<PendingTokenData>({
    queryKey: ['pending-token', tokenAddress, payeeAddress, splitterAddress || vaultAddress],
    queryFn: async () => {
      if (!tokenAddress) {
        throw new Error('Token address not configured');
      }
      const address = splitterAddress || getFeeSplitterAddress(vaultAddress);
      
      // If specific payee is provided, only get that payee's pending amount
      if (payeeAddress) {
        const pending = await readPendingToken(address, tokenAddress, payeeAddress);
        const revenueSplit = await readFeeSplitterData(address);
        
        // Determine which payee this is
        const isPayee1 = payeeAddress.toLowerCase() === revenueSplit.payee1?.toLowerCase();
        
        return {
          payee1Pending: isPayee1 ? pending : null,
          payee2Pending: isPayee1 ? null : pending,
        };
      }
      
      // Otherwise get both payees' pending amounts
      const revenueSplit = await readFeeSplitterData(address);
      
      if (!revenueSplit.payee1 || !revenueSplit.payee2) {
        return {
          payee1Pending: null,
          payee2Pending: null,
        };
      }
      
      const [payee1Pending, payee2Pending] = await Promise.all([
        readPendingToken(address, tokenAddress, revenueSplit.payee1),
        readPendingToken(address, tokenAddress, revenueSplit.payee2),
      ]);
      
      return {
        payee1Pending,
        payee2Pending,
      };
    },
    enabled: !!tokenAddress,
    staleTime: QUERY_STALE_TIME_SHORT,
    refetchInterval: QUERY_REFETCH_INTERVAL_SHORT,
  });
};

// Total released hook
export const useTotalReleased = (
  tokenAddress: Address | null,
  splitterAddress?: Address,
  vaultAddress?: Address
) => {
  return useQuery<bigint | null>({
    queryKey: ['total-released', tokenAddress, splitterAddress || vaultAddress],
    queryFn: async () => {
      if (!tokenAddress) {
        throw new Error('Token address not configured');
      }
      const address = splitterAddress || getFeeSplitterAddress(vaultAddress);
      return readTotalReleased(address, tokenAddress);
    },
    enabled: !!tokenAddress,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
};

// Released hook (for specific account)
export const useReleased = (
  tokenAddress: Address | null,
  accountAddress?: Address | null,
  splitterAddress?: Address,
  vaultAddress?: Address
) => {
  return useQuery<bigint | null>({
    queryKey: ['released', tokenAddress, accountAddress, splitterAddress || vaultAddress],
    queryFn: async () => {
      if (!tokenAddress || !accountAddress) {
        throw new Error('Token or account address not configured');
      }
      const address = splitterAddress || getFeeSplitterAddress(vaultAddress);
      return readReleased(address, tokenAddress, accountAddress);
    },
    enabled: !!tokenAddress && !!accountAddress,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
};
