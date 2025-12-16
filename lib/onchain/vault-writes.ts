'use client';

import { Address } from 'viem';
import { VAULT_ABI } from './client';

/**
 * MetaMorpho V1.1 vault write function configurations
 * These are used with wagmi's useWriteContract hook
 */

export interface SetCuratorParams {
  vaultAddress: Address;
  newCurator: Address;
}

export interface SubmitGuardianParams {
  vaultAddress: Address;
  newGuardian: Address;
}

export interface SetIsAllocatorParams {
  vaultAddress: Address;
  allocator: Address;
  isAllocator: boolean;
}

export interface TransferOwnershipParams {
  vaultAddress: Address;
  newOwner: Address;
}

export interface ReallocateParams {
  vaultAddress: Address;
  allocations: Array<{
    market: Address;
    assets: bigint;
  }>;
}

// Contract write configurations for wagmi
export const vaultWriteConfigs = {
  setCurator: (params: SetCuratorParams) => ({
    address: params.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'setCurator' as const,
    args: [params.newCurator] as const,
  }),

  submitGuardian: (params: SubmitGuardianParams) => ({
    address: params.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'submitGuardian' as const,
    args: [params.newGuardian] as const,
  }),

  acceptGuardian: (vaultAddress: Address) => ({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'acceptGuardian' as const,
    args: [] as const,
  }),

  setIsAllocator: (params: SetIsAllocatorParams) => ({
    address: params.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'setIsAllocator' as const,
    args: [params.allocator, params.isAllocator] as const,
  }),

  transferOwnership: (params: TransferOwnershipParams) => ({
    address: params.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'transferOwnership' as const,
    args: [params.newOwner] as const,
  }),

  renounceOwnership: (vaultAddress: Address) => ({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'renounceOwnership' as const,
    args: [] as const,
  }),

  reallocate: (params: ReallocateParams) => ({
    address: params.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'reallocate' as const,
    args: [params.allocations] as const,
  }),
};

