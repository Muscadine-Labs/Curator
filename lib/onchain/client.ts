import { createPublicClient, http, Address, Abi } from 'viem';
import { base } from '@/lib/onchain/base-chain';
import { getBaseRpcUrl } from '@/lib/onchain/rpc-url';
import { logger } from '@/lib/utils/logger';

const rpcUrl = getBaseRpcUrl();

const baseChain = {
  ...base,
  rpcUrls: {
    default: {
      http: [rpcUrl],
    },
    public: {
      http: [rpcUrl],
    },
  },
};

export const publicClient = createPublicClient({
  chain: baseChain,
  transport: http(),
});

export const safeContractRead = async <T>(
  contractAddress: Address,
  abi: Abi,
  functionName: string,
  args: unknown[] = []
): Promise<T | null> => {
  try {
    const result = await publicClient.readContract({
      address: contractAddress,
      abi,
      functionName,
      args,
    });
    return result as T;
  } catch (error) {
    logger.warn(`Failed to read ${functionName} from ${contractAddress}`, {
      contractAddress,
      functionName,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return null;
  }
};
