'use client';

import { useQuery } from '@tanstack/react-query';
import { Address } from 'viem';
import { readVaultRoles, readVaultAllocators, readPendingGuardian } from '@/lib/onchain/contracts';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { gql } from 'graphql-request';

export interface VaultRolesData {
  owner: Address | null;
  curator: Address | null;
  guardian: Address | null;
  timelock: Address | null;
  pendingGuardian: Address | null;
  allocators: Address[];
}

/**
 * Hook to fetch vault roles and allocators from blockchain and GraphQL
 */
export function useVaultRoles(vaultAddress: Address | null | undefined, chainId: number = 8453) {
  return useQuery<VaultRolesData>({
    queryKey: ['vault-roles', vaultAddress, chainId],
    queryFn: async () => {
      if (!vaultAddress) {
        throw new Error('Vault address is required');
      }

      // Fetch roles from blockchain
      const roles = await readVaultRoles(vaultAddress);
      const pendingGuardian = await readPendingGuardian(vaultAddress);

      // Try to fetch allocators from GraphQL API first (more reliable)
      let allocators: Address[] = [];
      
      try {
        const query = gql`
          query VaultAllocators($address: String!, $chainId: Int!) {
            vault: vaultByAddress(address: $address, chainId: $chainId) {
              allocators {
                address
              }
            }
          }
        `;

        const data = await morphoGraphQLClient.request<{
          vault: { allocators: Array<{ address: string }> } | null;
        }>(query, {
          address: vaultAddress,
          chainId,
        });

        if (data.vault?.allocators) {
          allocators = data.vault.allocators
            .map((a) => a.address as Address)
            .filter((addr) => addr && addr !== '0x0000000000000000000000000000000000000000');
        }
      } catch (error) {
        console.warn('Failed to fetch allocators from GraphQL, trying on-chain:', error);
      }

      // Fallback to on-chain read if GraphQL fails
      if (allocators.length === 0) {
        const onChainAllocators = await readVaultAllocators(vaultAddress);
        if (onChainAllocators) {
          allocators = onChainAllocators.filter(
            (addr) => addr && addr !== '0x0000000000000000000000000000000000000000'
          );
        }
      }

      return {
        owner: roles.owner,
        curator: roles.curator,
        guardian: roles.guardian,
        timelock: roles.timelock,
        pendingGuardian,
        allocators,
      };
    },
    enabled: !!vaultAddress,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

