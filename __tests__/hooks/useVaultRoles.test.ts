/**
 * Tests for useVaultRoles hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVaultRoles } from '@/lib/hooks/useVaultRoles';
import { readVaultRoles, readVaultAllocators, readPendingGuardian } from '@/lib/onchain/contracts';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { Address } from 'viem';
import React, { type ReactNode } from 'react';

// Mock the contract read functions
jest.mock('@/lib/onchain/contracts', () => ({
  readVaultRoles: jest.fn(),
  readVaultAllocators: jest.fn(),
  readPendingGuardian: jest.fn(),
}));

// Mock GraphQL client
jest.mock('@/lib/morpho/graphql-client', () => ({
  morphoGraphQLClient: {
    request: jest.fn(),
  },
}));

describe('useVaultRoles', () => {
  const mockVaultAddress = '0x1234567890123456789012345678901234567890' as Address;
  const mockOwner = '0x1111111111111111111111111111111111111111' as Address;
  const mockCurator = '0x2222222222222222222222222222222222222222' as Address;
  const mockGuardian = '0x3333333333333333333333333333333333333333' as Address;
  const mockTimelock = '0x4444444444444444444444444444444444444444' as Address;
  const mockAllocator1 = '0x5555555555555555555555555555555555555555' as Address;
  const mockAllocator2 = '0x6666666666666666666666666666666666666666' as Address;

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  it('should fetch roles and allocators from GraphQL successfully', async () => {
    (readVaultRoles as jest.Mock).mockResolvedValue({
      owner: mockOwner,
      curator: mockCurator,
      guardian: mockGuardian,
      timelock: mockTimelock,
    });

    (readPendingGuardian as jest.Mock).mockResolvedValue(null);

    (morphoGraphQLClient.request as jest.Mock).mockResolvedValue({
      vault: {
        allocators: [
          { address: mockAllocator1 },
          { address: mockAllocator2 },
        ],
      },
    });

    const { result } = renderHook(() => useVaultRoles(mockVaultAddress, 8453), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      owner: mockOwner,
      curator: mockCurator,
      guardian: mockGuardian,
      timelock: mockTimelock,
      pendingGuardian: null,
      allocators: [mockAllocator1, mockAllocator2],
    });
  });

  it('should fallback to on-chain allocators if GraphQL fails', async () => {
    (readVaultRoles as jest.Mock).mockResolvedValue({
      owner: mockOwner,
      curator: mockCurator,
      guardian: mockGuardian,
      timelock: mockTimelock,
    });

    (readPendingGuardian as jest.Mock).mockResolvedValue(null);

    (morphoGraphQLClient.request as jest.Mock).mockRejectedValue(new Error('GraphQL error'));

    (readVaultAllocators as jest.Mock).mockResolvedValue([mockAllocator1]);

    const { result } = renderHook(() => useVaultRoles(mockVaultAddress, 8453), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.allocators).toEqual([mockAllocator1]);
  });

  it('should handle pending guardian', async () => {
    const mockPendingGuardian = '0x7777777777777777777777777777777777777777' as Address;

    (readVaultRoles as jest.Mock).mockResolvedValue({
      owner: mockOwner,
      curator: mockCurator,
      guardian: mockGuardian,
      timelock: mockTimelock,
    });

    (readPendingGuardian as jest.Mock).mockResolvedValue(mockPendingGuardian);

    (morphoGraphQLClient.request as jest.Mock).mockResolvedValue({
      vault: {
        allocators: [],
      },
    });

    const { result } = renderHook(() => useVaultRoles(mockVaultAddress, 8453), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pendingGuardian).toBe(mockPendingGuardian);
  });

  it('should filter out zero addresses from allocators', async () => {
    (readVaultRoles as jest.Mock).mockResolvedValue({
      owner: mockOwner,
      curator: mockCurator,
      guardian: mockGuardian,
      timelock: mockTimelock,
    });

    (readPendingGuardian as jest.Mock).mockResolvedValue(null);

    (morphoGraphQLClient.request as jest.Mock).mockResolvedValue({
      vault: {
        allocators: [
          { address: mockAllocator1 },
          { address: '0x0000000000000000000000000000000000000000' },
          { address: mockAllocator2 },
        ],
      },
    });

    const { result } = renderHook(() => useVaultRoles(mockVaultAddress, 8453), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.allocators).toEqual([mockAllocator1, mockAllocator2]);
    expect(result.current.data?.allocators).not.toContain('0x0000000000000000000000000000000000000000');
  });

  it('should not fetch if vault address is null', () => {
    const { result } = renderHook(() => useVaultRoles(null, 8453), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
  });

  it('should handle errors gracefully', async () => {
    (readVaultRoles as jest.Mock).mockRejectedValue(new Error('Contract read failed'));

    const { result } = renderHook(() => useVaultRoles(mockVaultAddress, 8453), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });
});

