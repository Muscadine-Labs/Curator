'use client';

import { useQuery } from '@tanstack/react-query';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { gql } from 'graphql-request';
import { BASE_CHAIN_ID } from '@/lib/constants';
import type { Address } from 'viem';

export interface MarketCap {
  marketKey: string;
  loanAsset: {
    symbol: string;
    address: string;
  };
  collateralAsset: {
    symbol: string;
    address: string;
  };
  supplyCap: number | null;
  supplyAssets: number | null;
  supplyAssetsUsd: number | null;
  supplyQueueIndex: number | null;
  withdrawQueueIndex: number | null;
}

export interface VaultCapsData {
  markets: MarketCap[];
}

/**
 * Hook to fetch vault market caps from GraphQL
 */
export function useVaultCaps(vaultAddress: Address | string | null | undefined, chainId: number = BASE_CHAIN_ID) {
  return useQuery<VaultCapsData>({
    queryKey: ['vault-caps', vaultAddress, chainId],
    queryFn: async () => {
      if (!vaultAddress) {
        throw new Error('Vault address is required');
      }

      const query = gql`
        query VaultCaps($address: String!, $chainId: Int!) {
          vault: vaultByAddress(address: $address, chainId: $chainId) {
            state {
              allocation {
                supplyCap
                supplyAssets
                supplyAssetsUsd
                market {
                  uniqueKey
                  loanAsset {
                    symbol
                    address
                  }
                  collateralAsset {
                    symbol
                    address
                  }
                }
              }
              allocationQueues: allocation {
                supplyQueueIndex
                withdrawQueueIndex
                market {
                  uniqueKey
                }
              }
            }
          }
        }
      `;

      type VaultCapsResponse = {
        vault: {
          state?: {
            allocation?: Array<{
              supplyCap?: string | number | null;
              supplyAssets?: string | number | null;
              supplyAssetsUsd?: number | null;
              market?: {
                uniqueKey?: string | null;
                loanAsset?: {
                  symbol?: string | null;
                  address?: string | null;
                } | null;
                collateralAsset?: {
                  symbol?: string | null;
                  address?: string | null;
                } | null;
              } | null;
            } | null> | null;
            allocationQueues?: Array<{
              supplyQueueIndex?: number | null;
              withdrawQueueIndex?: number | null;
              market?: {
                uniqueKey?: string | null;
              } | null;
            } | null> | null;
          } | null;
        } | null;
      };

      const data = await morphoGraphQLClient.request<VaultCapsResponse>(query, {
        address: vaultAddress,
        chainId,
      });

      if (!data.vault?.state) {
        return { markets: [] };
      }

      const allocation = data.vault.state.allocation || [];
      const queues = data.vault.state.allocationQueues || [];

      // Create a map of market keys to queue indices
      const queueMap = new Map<string, { supplyQueueIndex: number | null; withdrawQueueIndex: number | null }>();
      queues.forEach((queue) => {
        if (queue.market?.uniqueKey) {
          queueMap.set(queue.market.uniqueKey, {
            supplyQueueIndex: queue.supplyQueueIndex ?? null,
            withdrawQueueIndex: queue.withdrawQueueIndex ?? null,
          });
        }
      });

      const markets: MarketCap[] = allocation
        .filter((alloc) => alloc.market?.uniqueKey)
        .map((alloc) => {
          const marketKey = alloc.market!.uniqueKey!;
          const queueInfo = queueMap.get(marketKey) || { supplyQueueIndex: null, withdrawQueueIndex: null };

          return {
            marketKey,
            loanAsset: {
              symbol: alloc.market!.loanAsset?.symbol || 'Unknown',
              address: alloc.market!.loanAsset?.address || '',
            },
            collateralAsset: {
              symbol: alloc.market!.collateralAsset?.symbol || 'Unknown',
              address: alloc.market!.collateralAsset?.address || '',
            },
            supplyCap: alloc.supplyCap
              ? typeof alloc.supplyCap === 'string'
                ? parseFloat(alloc.supplyCap)
                : Number(alloc.supplyCap)
              : null,
            supplyAssets: alloc.supplyAssets
              ? typeof alloc.supplyAssets === 'string'
                ? parseFloat(alloc.supplyAssets)
                : Number(alloc.supplyAssets)
              : null,
            supplyAssetsUsd: alloc.supplyAssetsUsd ?? null,
            supplyQueueIndex: queueInfo.supplyQueueIndex,
            withdrawQueueIndex: queueInfo.withdrawQueueIndex,
          };
        });

      return { markets };
    },
    enabled: !!vaultAddress,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

