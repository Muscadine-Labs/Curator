import { createPublicClient, http, Address, Abi } from 'viem';
import { base } from 'viem/chains';

// Base chain configuration
export const baseChain = {
  ...base,
  rpcUrls: {
    default: {
      http: [`https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || 'demo'}`],
    },
    public: {
      http: [`https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || 'demo'}`],
    },
  },
};

// Create viem public client
export const publicClient = createPublicClient({
  chain: baseChain,
  transport: http(),
});

// Contract addresses
export const CONTRACT_ADDRESSES = {
  FEE_SPLITTER: process.env.NEXT_PUBLIC_FEE_SPLITTER as Address,
} as const;

// Minimal ABIs for contract interactions
export const VAULT_ABI = [
  {
    name: 'asset',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'performanceFeeBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint16' }],
  },
  {
    name: 'lastHarvest',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Vault role functions (if available on contract)
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'curator',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'guardian',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'timelock',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  // Allocator functions (if available)
  {
    name: 'allocators',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'getAllocators',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  // Fee splitter function (if available on vault contract)
  {
    name: 'feeSplitter',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'getFeeSplitter',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

// Morpho Blue Vault Allocator ABI
// NOTE: This is a placeholder based on common Morpho Blue patterns.
// Update with the exact ABI from your vault contract if different.
export const MORPHO_BLUE_VAULT_ALLOCATOR_ABI = [
  {
    name: 'queueSupply',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'market', type: 'address' },
      { name: 'assets', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'queueWithdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'market', type: 'address' },
      { name: 'assets', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'reallocate',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'markets', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    name: 'updateAllocations',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'markets', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
] as const;

export const ERC20_ABI = [
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const ERC20_FEE_SPLITTER_ABI = [
  {
    name: 'PAYEE1',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'PAYEE2',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'SHARES1',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'SHARES2',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'TOTAL_SHARES',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'pendingToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'account', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalReleased',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'released',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'account', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'ERC20Claimed',
    type: 'event',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'account', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'payee', type: 'address' }
    ],
    outputs: [],
  },
  {
    name: 'claimAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' }
    ],
    outputs: [],
  },
] as const;

// Helper function to safely read contract data
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
    console.warn(`Failed to read ${functionName} from ${contractAddress}:`, error);
    return null;
  }
};

// Helper function for multicall
export const multicallRead = async <T>(
  contracts: Array<{
    address: Address;
    abi: Abi;
    functionName: string;
    args?: unknown[];
  }>
): Promise<(T | null)[]> => {
  try {
    const results = await publicClient.multicall({
      contracts: contracts.map(contract => ({
        address: contract.address,
        abi: contract.abi,
        functionName: contract.functionName,
        args: contract.args || [],
      })),
    });
    
    return results.map(result => {
      if (result.status === 'success') {
        return result.result as T;
      }
      return null;
    });
  } catch (error) {
    console.warn('Multicall failed:', error);
    return contracts.map(() => null);
  }
};
