/**
 * Tests for contract read functions
 */

import { readVaultRoles, readVaultAllocators, checkIsAllocator, readPendingGuardian } from '@/lib/onchain/contracts';
import { safeContractRead } from '@/lib/onchain/client';
import { Address } from 'viem';

// Mock the client module
jest.mock('@/lib/onchain/client', () => ({
  safeContractRead: jest.fn(),
  VAULT_ABI: [],
}));

describe('readVaultRoles', () => {
  const mockVaultAddress = '0x1234567890123456789012345678901234567890' as Address;
  const mockOwner = '0x1111111111111111111111111111111111111111' as Address;
  const mockCurator = '0x2222222222222222222222222222222222222222' as Address;
  const mockGuardian = '0x3333333333333333333333333333333333333333' as Address;
  const mockTimelock = '0x4444444444444444444444444444444444444444' as Address;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should read all roles successfully', async () => {
    (safeContractRead as jest.Mock)
      .mockResolvedValueOnce(mockOwner)
      .mockResolvedValueOnce(mockCurator)
      .mockResolvedValueOnce(mockGuardian)
      .mockResolvedValueOnce(mockTimelock);

    const result = await readVaultRoles(mockVaultAddress);

    expect(result).toEqual({
      owner: mockOwner,
      curator: mockCurator,
      guardian: mockGuardian,
      timelock: mockTimelock,
    });

    expect(safeContractRead).toHaveBeenCalledTimes(4);
    expect(safeContractRead).toHaveBeenCalledWith(mockVaultAddress, expect.anything(), 'owner');
    expect(safeContractRead).toHaveBeenCalledWith(mockVaultAddress, expect.anything(), 'curator');
    expect(safeContractRead).toHaveBeenCalledWith(mockVaultAddress, expect.anything(), 'guardian');
    expect(safeContractRead).toHaveBeenCalledWith(mockVaultAddress, expect.anything(), 'timelock');
  });

  it('should handle null values when contract read fails', async () => {
    (safeContractRead as jest.Mock)
      .mockResolvedValueOnce(mockOwner)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockGuardian)
      .mockResolvedValueOnce(null);

    const result = await readVaultRoles(mockVaultAddress);

    expect(result).toEqual({
      owner: mockOwner,
      curator: null,
      guardian: mockGuardian,
      timelock: null,
    });
  });
});

describe('readVaultAllocators', () => {
  const mockVaultAddress = '0x1234567890123456789012345678901234567890' as Address;
  const mockAllocators = [
    '0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222',
  ] as Address[];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should read allocators from first function', async () => {
    (safeContractRead as jest.Mock)
      .mockResolvedValueOnce(mockAllocators);

    const result = await readVaultAllocators(mockVaultAddress);

    expect(result).toEqual(mockAllocators);
    expect(safeContractRead).toHaveBeenCalledTimes(1);
    expect(safeContractRead).toHaveBeenCalledWith(mockVaultAddress, expect.anything(), 'allocators');
  });

  it('should fallback to getAllocators if first fails', async () => {
    (safeContractRead as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockAllocators);

    const result = await readVaultAllocators(mockVaultAddress);

    expect(result).toEqual(mockAllocators);
    expect(safeContractRead).toHaveBeenCalledTimes(2);
    expect(safeContractRead).toHaveBeenCalledWith(mockVaultAddress, expect.anything(), 'allocators');
    expect(safeContractRead).toHaveBeenCalledWith(mockVaultAddress, expect.anything(), 'getAllocators');
  });

  it('should return null if both functions fail', async () => {
    (safeContractRead as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await readVaultAllocators(mockVaultAddress);

    expect(result).toBeNull();
  });
});

describe('checkIsAllocator', () => {
  const mockVaultAddress = '0x1234567890123456789012345678901234567890' as Address;
  const mockAllocatorAddress = '0x1111111111111111111111111111111111111111' as Address;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true if address is allocator', async () => {
    (safeContractRead as jest.Mock).mockResolvedValueOnce(true);

    const result = await checkIsAllocator(mockVaultAddress, mockAllocatorAddress);

    expect(result).toBe(true);
    expect(safeContractRead).toHaveBeenCalledWith(
      mockVaultAddress,
      expect.anything(),
      'isAllocator',
      [mockAllocatorAddress]
    );
  });

  it('should return false if address is not allocator', async () => {
    (safeContractRead as jest.Mock).mockResolvedValueOnce(false);

    const result = await checkIsAllocator(mockVaultAddress, mockAllocatorAddress);

    expect(result).toBe(false);
  });

  it('should return null if contract read fails', async () => {
    (safeContractRead as jest.Mock).mockResolvedValueOnce(null);

    const result = await checkIsAllocator(mockVaultAddress, mockAllocatorAddress);

    expect(result).toBeNull();
  });
});

describe('readPendingGuardian', () => {
  const mockVaultAddress = '0x1234567890123456789012345678901234567890' as Address;
  const mockPendingGuardian = '0x5555555555555555555555555555555555555555' as Address;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should read pending guardian successfully', async () => {
    (safeContractRead as jest.Mock).mockResolvedValueOnce(mockPendingGuardian);

    const result = await readPendingGuardian(mockVaultAddress);

    expect(result).toBe(mockPendingGuardian);
    expect(safeContractRead).toHaveBeenCalledWith(mockVaultAddress, expect.anything(), 'pendingGuardian');
  });

  it('should return null if no pending guardian', async () => {
    (safeContractRead as jest.Mock).mockResolvedValueOnce(null);

    const result = await readPendingGuardian(mockVaultAddress);

    expect(result).toBeNull();
  });
});

