export interface VaultConfig {
  id: string;
  name: string;
  symbol: string;
  asset: string;
  address: string;
  chainId: number;
  scanUrl: string;
  performanceFeeBps: number;
  status: 'active' | 'paused' | 'deprecated';
  riskTier: 'low' | 'medium' | 'high';
  createdAt: string;
  description?: string;
}

export interface RoleConfig {
  owner: string;
  guardian: string;
  curator: string;
  allocators: {
    name: string;
    address: string;
    type: 'public' | 'private';
  }[];
}

export interface ProtocolConfig {
  chainId: number;
  chainName: string;
  defaultPerformanceFeeBps: number;
  roles: RoleConfig;
}

// Hard-coded vault configurations
export const vaults: VaultConfig[] = [
  {
    id: 'usdc-vault',
    name: 'Muscadine USDC Vault',
    symbol: 'mUSDC',
    asset: 'USDC',
    address: process.env.NEXT_PUBLIC_VAULT_USDC || '0xf7e26Fa48A568b8b0038e104DfD8ABdf0f99074F',
    chainId: 8453,
    scanUrl: 'https://basescan.org/address/0xf7e26Fa48A568b8b0038e104DfD8ABdf0f99074F',
    performanceFeeBps: 200,
    status: 'active',
    riskTier: 'low',
    createdAt: '2024-01-15T00:00:00Z',
    description: 'USDC yield vault with low risk strategy'
  },
  {
    id: 'cbbtc-vault',
    name: 'Muscadine cbBTC Vault',
    symbol: 'mcbBTC',
    asset: 'cbBTC',
    address: process.env.NEXT_PUBLIC_VAULT_CBBTC || '0xAeCc8113a7bD0CFAF7000EA7A31afFD4691ff3E9',
    chainId: 8453,
    scanUrl: 'https://basescan.org/address/0xaecc8113a7bd0cfaf7000ea7a31affd4691ff3e9',
    performanceFeeBps: 200,
    status: 'active',
    riskTier: 'medium',
    createdAt: '2024-02-01T00:00:00Z',
    description: 'cbBTC yield vault with medium risk strategy'
  },
  {
    id: 'weth-vault',
    name: 'Muscadine WETH Vault',
    symbol: 'mWETH',
    asset: 'WETH',
    address: process.env.NEXT_PUBLIC_VAULT_WETH || '0x21e0d366272798da3A977FEBA699FCB91959d120',
    chainId: 8453,
    scanUrl: 'https://basescan.org/address/0x21e0d366272798da3A977FEBA699FCB91959d120',
    performanceFeeBps: 200,
    status: 'active',
    riskTier: 'medium',
    createdAt: '2024-02-15T00:00:00Z',
    description: 'WETH yield vault with medium risk strategy'
  }
];

// Protocol configuration
export const protocolConfig: ProtocolConfig = {
  chainId: 8453,
  chainName: 'Base',
  defaultPerformanceFeeBps: parseInt(process.env.NEXT_PUBLIC_DEFAULT_PERF_FEE_BPS || '200'),
  roles: {
    owner: process.env.NEXT_PUBLIC_ROLE_OWNER || '0x4E5D3ef790C75682ac4f6d4C1dDCc08b36fC100A',
    guardian: process.env.NEXT_PUBLIC_ROLE_GUARDIAN || '0x64e804eEF4F5a53272A8623b563ad2724E98A0a9',
    curator: process.env.NEXT_PUBLIC_ROLE_CURATOR || '0xb6d1d784e9Bc3570546e231caCB52B4E0f1ED8b1',
    allocators: [
      {
        name: 'Public Allocator (Morpho SC)',
        address: '0x0000000000000000000000000000000000000000',
        type: 'public'
      },
      {
        name: 'Muscadine Hot Wallet',
        address: process.env.NEXT_PUBLIC_ALLOCATOR_HOT || '0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333',
        type: 'private'
      },
      {
        name: 'Ignas Smart Wallet',
        address: process.env.NEXT_PUBLIC_ALLOCATOR_IGNAS || '0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261',
        type: 'private'
      }
    ]
  }
};

// Helper functions
export const getVaultById = (id: string): VaultConfig | undefined => {
  return vaults.find(vault => vault.id === id);
};

export const getVaultByAddress = (address: string): VaultConfig | undefined => {
  return vaults.find(vault => vault.address.toLowerCase() === address.toLowerCase());
};

export const getActiveVaults = (): VaultConfig[] => {
  return vaults.filter(vault => vault.status === 'active');
};

export const getVaultsByAsset = (asset: string): VaultConfig[] => {
  return vaults.filter(vault => vault.asset.toLowerCase() === asset.toLowerCase());
};

export const getVaultsByRiskTier = (riskTier: string): VaultConfig[] => {
  return vaults.filter(vault => vault.riskTier === riskTier);
};
