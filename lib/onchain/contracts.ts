import { Address } from 'viem';
import { VAULT_ABI, ERC20_ABI, ERC20_FEE_SPLITTER_ABI, safeContractRead } from './client';

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

export interface FeeSplitterData {
  payee1: Address | null;
  payee2: Address | null;
  shares1: bigint | null;
  shares2: bigint | null;
  totalShares: bigint | null;
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

// Fee splitter contract reader
export const readFeeSplitterData = async (splitterAddress: Address): Promise<FeeSplitterData> => {
  const [payee1, payee2, shares1, shares2, totalShares] = await Promise.all([
    safeContractRead<Address>(splitterAddress, ERC20_FEE_SPLITTER_ABI, 'PAYEE1'),
    safeContractRead<Address>(splitterAddress, ERC20_FEE_SPLITTER_ABI, 'PAYEE2'),
    safeContractRead<bigint>(splitterAddress, ERC20_FEE_SPLITTER_ABI, 'SHARES1'),
    safeContractRead<bigint>(splitterAddress, ERC20_FEE_SPLITTER_ABI, 'SHARES2'),
    safeContractRead<bigint>(splitterAddress, ERC20_FEE_SPLITTER_ABI, 'TOTAL_SHARES'),
  ]);

  return {
    payee1,
    payee2,
    shares1,
    shares2,
    totalShares,
  };
};

// Pending token reader
export const readPendingToken = async (
  splitterAddress: Address,
  tokenAddress: Address,
  accountAddress: Address
): Promise<bigint | null> => {
  return safeContractRead<bigint>(
    splitterAddress,
    ERC20_FEE_SPLITTER_ABI,
    'pendingToken',
    [tokenAddress, accountAddress]
  );
};

// Total released reader
export const readTotalReleased = async (
  splitterAddress: Address,
  tokenAddress: Address
): Promise<bigint | null> => {
  return safeContractRead<bigint>(
    splitterAddress,
    ERC20_FEE_SPLITTER_ABI,
    'totalReleased',
    [tokenAddress]
  );
};

// Released reader (for specific account)
export const readReleased = async (
  splitterAddress: Address,
  tokenAddress: Address,
  accountAddress: Address
): Promise<bigint | null> => {
  return safeContractRead<bigint>(
    splitterAddress,
    ERC20_FEE_SPLITTER_ABI,
    'released',
    [tokenAddress, accountAddress]
  );
};

// Helper to calculate percentage from basis points
export const bpsToPercentage = (bps: number | null): number => {
  if (!bps) return 0;
  return bps / 100;
};

// Helper to calculate shares percentage
export const calculateSharePercentage = (
  shares: bigint | null,
  totalShares: bigint | null
): number => {
  if (!shares || !totalShares || totalShares === BigInt(0)) return 0;
  return Number(shares) / Number(totalShares) * 100;
};
