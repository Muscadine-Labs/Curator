import {
  prepareAllocations,
  validateAllocations,
  formatAllocationAmount,
  MAX_UINT256,
  type MarketParams,
  type MarketAllocation,
} from '@/lib/onchain/allocation-utils';
import { getAddress } from 'viem';

describe('allocation-utils', () => {
  const mockMarketParams: Omit<MarketParams, 'lltv'> & { lltv: string } = {
    loanToken: getAddress('0x1234567890123456789012345678901234567890'),
    collateralToken: getAddress('0x0987654321098765432109876543210987654321'),
    oracle: getAddress('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'),
    irm: getAddress('0xfedcbafedcbafedcbafedcbafedcbafedcbafedc'),
    lltv: '860000000000000000', // 0.86 in wei format
  };

  describe('prepareAllocations', () => {
    it('should convert allocations to MarketAllocation format', () => {
      const allocations = [
        {
          loanAssetAddress: mockMarketParams.loanToken,
          collateralAssetAddress: mockMarketParams.collateralToken,
          oracleAddress: mockMarketParams.oracle,
          irmAddress: mockMarketParams.irm,
          lltv: mockMarketParams.lltv,
          assets: '1000000000000000000', // 1 token with 18 decimals
        },
      ];

      const result = prepareAllocations(allocations);

      expect(result).toHaveLength(1);
      expect(result[0].marketParams.loanToken).toBe(mockMarketParams.loanToken);
      expect(result[0].marketParams.collateralToken).toBe(mockMarketParams.collateralToken);
      expect(result[0].marketParams.oracle).toBe(mockMarketParams.oracle);
      expect(result[0].marketParams.irm).toBe(mockMarketParams.irm);
      expect(result[0].marketParams.lltv).toBe(BigInt(mockMarketParams.lltv));
      expect(result[0].assets).toBe(BigInt('1000000000000000000'));
    });

    it('should set last allocation to MAX_UINT256 when useMaxForLast is true', () => {
      const allocations = [
        {
          loanAssetAddress: mockMarketParams.loanToken,
          collateralAssetAddress: mockMarketParams.collateralToken,
          oracleAddress: mockMarketParams.oracle,
          irmAddress: mockMarketParams.irm,
          lltv: mockMarketParams.lltv,
          assets: '1000000000000000000',
        },
        {
          loanAssetAddress: mockMarketParams.loanToken,
          collateralAssetAddress: mockMarketParams.collateralToken,
          oracleAddress: mockMarketParams.oracle,
          irmAddress: mockMarketParams.irm,
          lltv: mockMarketParams.lltv,
          assets: '2000000000000000000',
        },
      ];

      const result = prepareAllocations(allocations, true);

      expect(result).toHaveLength(2);
      expect(result[0].assets).toBe(BigInt('1000000000000000000'));
      expect(result[1].assets).toBe(MAX_UINT256); // Last allocation should be MAX
    });

    it('should handle bigint values', () => {
      const allocations = [
        {
          loanAssetAddress: mockMarketParams.loanToken,
          collateralAssetAddress: mockMarketParams.collateralToken,
          oracleAddress: mockMarketParams.oracle,
          irmAddress: mockMarketParams.irm,
          lltv: BigInt(mockMarketParams.lltv),
          assets: BigInt('1000000000000000000'),
        },
      ];

      const result = prepareAllocations(allocations);

      expect(result[0].marketParams.lltv).toBe(BigInt(mockMarketParams.lltv));
      expect(result[0].assets).toBe(BigInt('1000000000000000000'));
    });
  });

  describe('validateAllocations', () => {
    it('should validate allocations with all required fields', () => {
      const allocations: MarketAllocation[] = [
        {
          marketParams: {
            ...mockMarketParams,
            lltv: BigInt(mockMarketParams.lltv),
          },
          assets: BigInt('1000000000000000000'),
        },
      ];

      const result = validateAllocations(allocations, BigInt('2000000000000000000'));

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject allocations missing marketParams', () => {
      // Create an invalid allocation with null marketParams
      const invalidAllocation = {
        marketParams: null,
        assets: BigInt('1000000000000000000'),
      } as unknown as MarketAllocation;

      const result = validateAllocations([invalidAllocation], BigInt('2000000000000000000'));

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing marketParams');
    });

    it('should reject allocations with missing required fields', () => {
      // Create an invalid allocation with undefined loanToken
      const invalidAllocation = {
        marketParams: {
          ...mockMarketParams,
          lltv: BigInt(mockMarketParams.lltv),
          loanToken: undefined,
        },
        assets: BigInt('1000000000000000000'),
      } as unknown as MarketAllocation;

      const result = validateAllocations([invalidAllocation], BigInt('2000000000000000000'));

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('should reject allocations exceeding reasonable limits', () => {
      const allocations: MarketAllocation[] = [
        {
          marketParams: {
            ...mockMarketParams,
            lltv: BigInt(mockMarketParams.lltv),
          },
          assets: BigInt('1000000000000000000000000'), // Very large amount
        },
      ];

      const result = validateAllocations(allocations, BigInt('1000000000000000000')); // Small total

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds reasonable limits');
    });
  });

  describe('formatAllocationAmount', () => {
    it('should format amounts with 18 decimals', () => {
      const amount = BigInt('1000000000000000000'); // 1 token
      const result = formatAllocationAmount(amount, 18);

      expect(result).toBe('1');
    });

    it('should format amounts with 6 decimals', () => {
      const amount = BigInt('1000000'); // 1 USDC
      const result = formatAllocationAmount(amount, 6);

      expect(result).toBe('1');
    });

    it('should format fractional amounts', () => {
      const amount = BigInt('123456789000000000'); // 0.123456789 tokens
      const result = formatAllocationAmount(amount, 18);

      expect(result).toBe('0.123456789');
    });

    it('should trim trailing zeros', () => {
      const amount = BigInt('123400000000000000'); // 0.1234 tokens
      const result = formatAllocationAmount(amount, 18);

      expect(result).toBe('0.1234');
    });

    it('should include symbol when provided', () => {
      const amount = BigInt('1000000000000000000');
      const result = formatAllocationAmount(amount, 18, 'USDC');

      expect(result).toBe('1 USDC');
    });
  });

  describe('MAX_UINT256', () => {
    it('should be the maximum uint256 value', () => {
      expect(MAX_UINT256).toBe(BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'));
    });

    it('should be used for dust handling in last allocation', () => {
      const allocations = [
        {
          loanAssetAddress: mockMarketParams.loanToken,
          collateralAssetAddress: mockMarketParams.collateralToken,
          oracleAddress: mockMarketParams.oracle,
          irmAddress: mockMarketParams.irm,
          lltv: mockMarketParams.lltv,
          assets: '1000000000000000000',
        },
      ];

      const result = prepareAllocations(allocations, true);

      expect(result[0].assets).toBe(MAX_UINT256);
    });
  });
});

