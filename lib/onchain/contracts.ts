import { Address } from 'viem';
import { VAULT_ABI, ERC20_ABI, safeContractRead } from './client';

// Contract interfaces
export interface VaultData {
  asset: Address | null;
  totalAssets: bigint | null;
  performanceFeeBps: number | null;
  lastHarvest: bigint | null;
}

export interface ERC20Data {
  symbol: string | null;
  decimals: number | null;
  balance: bigint | null;
}

// Vault contract reader
export const readVaultData = async (vaultAddress: Address): Promise<VaultData> => {
  const [asset, totalAssets, performanceFeeBps, lastHarvest] = await Promise.all([
    safeContractRead<Address>(vaultAddress, VAULT_ABI, 'asset'),
    safeContractRead<bigint>(vaultAddress, VAULT_ABI, 'totalAssets'),
    safeContractRead<number>(vaultAddress, VAULT_ABI, 'performanceFeeBps'),
    safeContractRead<bigint>(vaultAddress, VAULT_ABI, 'lastHarvest'),
  ]);

  return {
    asset,
    totalAssets,
    performanceFeeBps,
    lastHarvest,
  };
};

// Vault roles interface
export interface VaultRoles {
  owner: Address | null;
  curator: Address | null;
  guardian: Address | null;
  timelock: Address | null;
}

// Read vault roles from contract (with fallback to null if not available)
export const readVaultRoles = async (vaultAddress: Address): Promise<VaultRoles> => {
  const [owner, curator, guardian, timelock] = await Promise.all([
    safeContractRead<Address>(vaultAddress, VAULT_ABI, 'owner'),
    safeContractRead<Address>(vaultAddress, VAULT_ABI, 'curator'),
    safeContractRead<Address>(vaultAddress, VAULT_ABI, 'guardian'),
    safeContractRead<Address>(vaultAddress, VAULT_ABI, 'timelock'),
  ]);

  return {
    owner,
    curator,
    guardian,
    timelock,
  };
};

// Read allocator addresses from contract
// MetaMorpho V1.1 uses a mapping, so we need to check known allocators or use events
// For now, we'll try to read from GraphQL API first, then fallback to checking known addresses
export const readVaultAllocators = async (vaultAddress: Address): Promise<Address[] | null> => {
  // Try different function names that might be used
  const allocators1 = await safeContractRead<Address[]>(vaultAddress, VAULT_ABI, 'allocators');
  if (allocators1) return allocators1;
  
  const allocators2 = await safeContractRead<Address[]>(vaultAddress, VAULT_ABI, 'getAllocators');
  if (allocators2) return allocators2;
  
  return null;
};

// Check if an address is an allocator (for mapping-based storage)
export const checkIsAllocator = async (
  vaultAddress: Address,
  allocatorAddress: Address
): Promise<boolean | null> => {
  return safeContractRead<boolean>(vaultAddress, VAULT_ABI, 'isAllocator', [allocatorAddress]);
};

// Read pending guardian
export const readPendingGuardian = async (vaultAddress: Address): Promise<Address | null> => {
  return safeContractRead<Address>(vaultAddress, VAULT_ABI, 'pendingGuardian');
};

// ERC20 contract reader
export const readERC20Data = async (
  tokenAddress: Address,
  accountAddress?: Address
): Promise<ERC20Data> => {
  const [symbol, decimals, balance] = await Promise.all([
    safeContractRead<string>(tokenAddress, ERC20_ABI, 'symbol'),
    safeContractRead<number>(tokenAddress, ERC20_ABI, 'decimals'),
    accountAddress 
      ? safeContractRead<bigint>(tokenAddress, ERC20_ABI, 'balanceOf', [accountAddress])
      : Promise.resolve(null),
  ]);

  return {
    symbol,
    decimals,
    balance,
  };
};

// Helper to calculate percentage from basis points
export const bpsToPercentage = (bps: number | null): number => {
  if (!bps) return 0;
  return bps / 100;
};
