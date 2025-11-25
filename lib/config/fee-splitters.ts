import { Address } from 'viem';
import { vaults } from './vaults';
import { FEE_SPLITTER_V1, FEE_SPLITTER_V2 } from '@/lib/constants';

/**
 * Fee Splitter Configuration
 * Maps vaults to their corresponding fee splitter contracts
 */

export interface FeeSplitterConfig {
  address: Address;
  name: string;
  description?: string;
  vaultAddresses: Address[];
}

// Fee Splitter addresses are now in lib/constants.ts
// Re-export for backward compatibility
export { FEE_SPLITTER_V1, FEE_SPLITTER_V2 };

// V1 Vaults (USDC, cbBTC, WETH)
const V1_VAULTS: Address[] = [
  '0xf7e26Fa48A568b8b0038e104DfD8ABdf0f99074F', // Muscadine USDC Vault
  '0xAeCc8113a7bD0CFAF7000EA7A31afFD4691ff3E9', // Muscadine cbBTC Vault
  '0x21e0d366272798da3A977FEBA699FCB91959d120', // Muscadine WETH Vault
].map(addr => addr.toLowerCase() as Address);

// V2 Vaults (Prime vaults)
const V2_VAULTS: Address[] = [
  '0x89712980cb434ef5ae4ab29349419eb976b0b496', // Muscadine USDC Prime
  '0xd6dcad2f7da91fbb27bda471540d9770c97a5a43', // Muscadine WETH Prime
  '0x99dcd0d75822ba398f13b2a8852b07c7e137ec70', // Muscadine cbBTC Prime
].map(addr => addr.toLowerCase() as Address);

// Testing vault (not included in production fee splitter)
const TESTING_VAULT: Address = '0xb15a51f46a53cf7dbb378a459a552f342bc54815'.toLowerCase() as Address;

/**
 * Fee splitter configurations
 */
export const feeSplitters: FeeSplitterConfig[] = [
  {
    address: FEE_SPLITTER_V1,
    name: 'Fee Splitter V1',
    description: 'Original fee splitter contract',
    vaultAddresses: [], // Will be populated from vaults config
  },
  {
    address: FEE_SPLITTER_V2,
    name: 'Fee Splitter V2',
    description: 'Fee splitter for V1 and V2 vaults',
    vaultAddresses: [...V1_VAULTS, ...V2_VAULTS],
  },
];

/**
 * Get the fee splitter address for a given vault address
 * Uses hardcoded mapping (for backward compatibility with sync usage)
 * For on-chain reading, use getFeeSplitterForVaultAsync instead
 */
export function getFeeSplitterForVault(vaultAddress: Address): Address | null {
  const vaultAddrLower = vaultAddress.toLowerCase();
  
  // Check if it's a testing vault (no fee splitter)
  if (vaultAddrLower === TESTING_VAULT.toLowerCase()) {
    return null;
  }
  
  // Check V2 splitter first (handles both V1 and V2 vaults)
  const v2Splitter = feeSplitters.find(splitter => 
    splitter.address.toLowerCase() === FEE_SPLITTER_V2.toLowerCase()
  );
  
  if (v2Splitter && v2Splitter.vaultAddresses.some(addr => addr.toLowerCase() === vaultAddrLower)) {
    return FEE_SPLITTER_V2;
  }
  
  // Check V1 splitter (fallback for any other vaults)
  const v1Splitter = feeSplitters.find(splitter => 
    splitter.address.toLowerCase() === FEE_SPLITTER_V1.toLowerCase()
  );
  
  if (v1Splitter) {
    return FEE_SPLITTER_V1;
  }
  
  return null;
}

/**
 * Async version that reads fee splitter from contract first, falls back to hardcoded mapping
 * Use this when you can handle async operations (e.g., in API routes)
 */
export async function getFeeSplitterForVaultAsync(vaultAddress: Address): Promise<Address | null> {
  const vaultAddrLower = vaultAddress.toLowerCase();
  
  // Check if it's a testing vault (no fee splitter)
  if (vaultAddrLower === TESTING_VAULT.toLowerCase()) {
    return null;
  }
  
  // Try to read from contract first
  try {
    const { readVaultFeeSplitter } = await import('@/lib/onchain/contracts');
    const onChainSplitter = await readVaultFeeSplitter(vaultAddress);
    if (onChainSplitter) {
      return onChainSplitter;
    }
  } catch (error) {
    // If on-chain read fails, fall back to hardcoded mapping
    console.warn(`Failed to read fee splitter from contract ${vaultAddress}, using hardcoded mapping:`, error);
  }
  
  // Fallback to hardcoded mapping
  return getFeeSplitterForVault(vaultAddress);
}

/**
 * Get all fee splitter addresses
 */
export function getAllFeeSplitters(): Address[] {
  return feeSplitters.map(splitter => splitter.address);
}

/**
 * Get fee splitter config by address
 */
export function getFeeSplitterConfig(address: Address): FeeSplitterConfig | null {
  return feeSplitters.find(
    splitter => splitter.address.toLowerCase() === address.toLowerCase()
  ) || null;
}

/**
 * Get vaults for a specific fee splitter
 */
export function getVaultsForFeeSplitter(splitterAddress: Address): Address[] {
  const config = getFeeSplitterConfig(splitterAddress);
  if (!config) return [];
  
  // If vaultAddresses is empty, get from vaults config
  if (config.vaultAddresses.length === 0) {
    return vaults
      .filter(vault => {
        const vaultAddr = vault.address.toLowerCase() as Address;
        // Exclude V2 splitter vaults and testing vault
        return !V2_VAULTS.includes(vaultAddr) && 
               !V1_VAULTS.includes(vaultAddr) && 
               vaultAddr !== TESTING_VAULT;
      })
      .map(vault => vault.address.toLowerCase() as Address);
  }
  
  return config.vaultAddresses;
}

