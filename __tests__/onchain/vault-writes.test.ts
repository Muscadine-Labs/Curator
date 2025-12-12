/**
 * Tests for vault write configurations
 */

import { vaultWriteConfigs } from '@/lib/onchain/vault-writes';
import { Address } from 'viem';

describe('vaultWriteConfigs', () => {
  const mockVaultAddress = '0x1234567890123456789012345678901234567890' as Address;
  const mockNewAddress = '0x9876543210987654321098765432109876543210' as Address;

  describe('setCurator', () => {
    it('should create correct config for setCurator', () => {
      const config = vaultWriteConfigs.setCurator({
        vaultAddress: mockVaultAddress,
        newCurator: mockNewAddress,
      });

      expect(config.address).toBe(mockVaultAddress);
      expect(config.functionName).toBe('setCurator');
      expect(config.args).toEqual([mockNewAddress]);
    });
  });

  describe('submitGuardian', () => {
    it('should create correct config for submitGuardian', () => {
      const config = vaultWriteConfigs.submitGuardian({
        vaultAddress: mockVaultAddress,
        newGuardian: mockNewAddress,
      });

      expect(config.address).toBe(mockVaultAddress);
      expect(config.functionName).toBe('submitGuardian');
      expect(config.args).toEqual([mockNewAddress]);
    });
  });

  describe('acceptGuardian', () => {
    it('should create correct config for acceptGuardian', () => {
      const config = vaultWriteConfigs.acceptGuardian(mockVaultAddress);

      expect(config.address).toBe(mockVaultAddress);
      expect(config.functionName).toBe('acceptGuardian');
      expect(config.args).toEqual([]);
    });
  });

  describe('setIsAllocator', () => {
    it('should create correct config for setIsAllocator (add)', () => {
      const config = vaultWriteConfigs.setIsAllocator({
        vaultAddress: mockVaultAddress,
        allocator: mockNewAddress,
        isAllocator: true,
      });

      expect(config.address).toBe(mockVaultAddress);
      expect(config.functionName).toBe('setIsAllocator');
      expect(config.args).toEqual([mockNewAddress, true]);
    });

    it('should create correct config for setIsAllocator (remove)', () => {
      const config = vaultWriteConfigs.setIsAllocator({
        vaultAddress: mockVaultAddress,
        allocator: mockNewAddress,
        isAllocator: false,
      });

      expect(config.address).toBe(mockVaultAddress);
      expect(config.functionName).toBe('setIsAllocator');
      expect(config.args).toEqual([mockNewAddress, false]);
    });
  });

  describe('transferOwnership', () => {
    it('should create correct config for transferOwnership', () => {
      const config = vaultWriteConfigs.transferOwnership({
        vaultAddress: mockVaultAddress,
        newOwner: mockNewAddress,
      });

      expect(config.address).toBe(mockVaultAddress);
      expect(config.functionName).toBe('transferOwnership');
      expect(config.args).toEqual([mockNewAddress]);
    });
  });

  describe('renounceOwnership', () => {
    it('should create correct config for renounceOwnership', () => {
      const config = vaultWriteConfigs.renounceOwnership(mockVaultAddress);

      expect(config.address).toBe(mockVaultAddress);
      expect(config.functionName).toBe('renounceOwnership');
      expect(config.args).toEqual([]);
    });
  });
});

