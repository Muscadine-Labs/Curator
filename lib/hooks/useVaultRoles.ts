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
 * Hook to fetch vault roles and allocators from GraphQL (with blockchain fallback)
 */
export function useVaultRoles(vaultAddress: Address | null | undefined, chainId: number = 8453) {
  return useQuery<VaultRolesData>({
    queryKey: ['vault-roles', vaultAddress, chainId],
    queryFn: async () => {
      if (!vaultAddress) {
        throw new Error('Vault address is required');
      }

      // Try to fetch from GraphQL first
      try {
        const query = gql`
          query VaultRoles($address: String!, $chainId: Int!) {
            vault: vaultByAddress(address: $address, chainId: $chainId) {
              state {
                owner
                curator
                guardian
                timelock
              }
              allocators {
                address
              }
            }
          }
        `;

        const data = await morphoGraphQLClient.request<{
          vault: {
            state?: {
              owner?: string | null;
              curator?: string | null;
              guardian?: string | null;
              timelock?: string | null;
            } | null;
            allocators?: Array<{ address: string }> | null;
          } | null;
        }>(query, {
          address: vaultAddress,
          chainId,
        });

        if (data.vault) {
          const allocators: Address[] = (data.vault.allocators || [])
            .map((a) => a.address as Address)
            .filter((addr) => addr && addr !== '0x0000000000000000000000000000000000000000');

          return {
            owner: (data.vault.state?.owner as Address) || null,
            curator: (data.vault.state?.curator as Address) || null,
            guardian: (data.vault.state?.guardian as Address) || null,
            timelock: (data.vault.state?.timelock as Address) || null,
            pendingGuardian: null, // GraphQL doesn't have pending guardian, fallback to on-chain if needed
            allocators,
          };
        }
      } catch (error) {
        console.warn('Failed to fetch roles from GraphQL, trying on-chain:', error);
      }

      // Fallback to on-chain reads if GraphQL fails
      const roles = await readVaultRoles(vaultAddress);
      const pendingGuardian = await readPendingGuardian(vaultAddress);
      
      let allocators: Address[] = [];
      try {
        const onChainAllocators = await readVaultAllocators(vaultAddress);
        if (onChainAllocators) {
          allocators = onChainAllocators.filter(
            (addr) => addr && addr !== '0x0000000000000000000000000000000000000000'
          );
        }
      } catch (error) {
        console.warn('Failed to fetch allocators on-chain:', error);
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

