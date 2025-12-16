import { createPublicClient, http, Address, Abi } from 'viem';
import { base } from 'viem/chains';

// Determine RPC URL based on available API keys
// Priority: ALCHEMY_API_KEY > COINBASE_CDP_API_KEY > demo fallback
function getRpcUrl(): string {
  // Alchemy (primary)
  if (process.env.ALCHEMY_API_KEY) {
    return `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  }
  
  // Coinbase CDP fallback (if using CDP RPC service)
  // Format may be: https://base-mainnet.cdp.coinbase.com/v1/[API_KEY]
  // Or: https://base.cdp.coinbase.com/[API_KEY]
  // Check Coinbase CDP docs for exact endpoint format
  if (process.env.COINBASE_CDP_API_KEY) {
    return `https://base-mainnet.cdp.coinbase.com/v1/${process.env.COINBASE_CDP_API_KEY}`;
  }
  
  // Demo fallback (rate limited)
  return 'https://base-mainnet.g.alchemy.com/v2/demo';
}

// Base chain configuration
export const baseChain = {
  ...base,
  rpcUrls: {
    default: {
      http: [getRpcUrl()],
    },
    public: {
      http: [getRpcUrl()],
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
  // MetaMorpho V1.1 write functions for role management
  {
    name: 'setCurator',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newCurator', type: 'address' }],
    outputs: [],
  },
  {
    name: 'submitGuardian',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newGuardian', type: 'address' }],
    outputs: [],
  },
  {
    name: 'acceptGuardian',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'setIsAllocator',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'allocator', type: 'address' },
      { name: 'newIsAllocator', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'transferOwnership',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
  },
  {
    name: 'renounceOwnership',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // Check if allocator is enabled (mapping-based)
  {
    name: 'isAllocator',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'allocator', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  // Pending guardian functions
  {
    name: 'pendingGuardian',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  // Reallocate function for MetaMorpho V1 vaults
  {
    name: 'reallocate',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'allocations',
        type: 'tuple[]',
        components: [
          { name: 'market', type: 'address' },
          { name: 'assets', type: 'uint256' },
        ],
      },
    ],
    outputs: [],
  },
] as const;

// Morpho Blue Vault Allocator ABI
// NOTE: This is a placeholder based on common Morpho Blue patterns.
// Update with the exact ABI from your vault contract if different.
//
// According to Morpho Blue MetaMorpho vault documentation:
// - reallocate(markets, amounts) function signature:
//   * markets: address[] - Market identifiers (in Morpho Blue, markets are identified by uniqueKey bytes32,
//     which must be converted to address format by taking the first 20 bytes)
//   * amounts: uint256[] - Amounts in the vault's asset (e.g., USDC for USDC vault, WETH for WETH vault)
//     * Amounts represent how much of the vault's asset to allocate to each market
//     * Amounts must be in the vault asset's native units (with proper decimals)
//     * For USDC vault: amounts in USDC (6 decimals), e.g., $1000 = 1000 * 10^6 = 1,000,000,000
//     * For WETH vault: amounts in WETH (18 decimals), e.g., $1000 ≈ 0.4 WETH * 10^18 (if WETH = $2500)
//   * The function reallocates vault assets across the specified markets
//   * Amounts should typically sum to vault's totalAssets or desired allocation amount
//   * Access control: Only authorized allocators can call this function
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
