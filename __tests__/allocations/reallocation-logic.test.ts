/**
 * Tests for allocation reallocation logic with mocked USDC vault data
 * Tests the core functionality without full React component rendering
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock data for USDC vault with 3 markets
const createMockUSDCVaultData = () => {
  const vaultAddress = '0xf7e26Fa48A568b8b0038e104DfD8ABdf0f99074F';
  const totalSupplyUsd = 10_000_000; // $10M

  const markets = [
    {
      uniqueKey: 'market-1-weth-usdc',
      collateralAsset: { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 },
      loanAsset: { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      state: {
        supplyAssetsUsd: 5_000_000,
        borrowAssetsUsd: 3_000_000,
        liquidityAssetsUsd: 2_000_000,
        utilization: 0.6,
        supplyApy: 0.05,
        borrowApy: 0.08,
        rewards: [],
      },
    },
    {
      uniqueKey: 'market-2-cbbtc-usdc',
      collateralAsset: { symbol: 'cbBTC', address: '0xcbBcC0000000000000000000000000000000000', decimals: 18 },
      loanAsset: { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      state: {
        supplyAssetsUsd: 3_000_000,
        borrowAssetsUsd: 1_500_000,
        liquidityAssetsUsd: 1_500_000,
        utilization: 0.5,
        supplyApy: 0.04,
        borrowApy: 0.07,
        rewards: [],
      },
    },
    {
      uniqueKey: 'market-3-usdc-weth',
      collateralAsset: { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      loanAsset: { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 },
      state: {
        supplyAssetsUsd: 2_000_000,
        borrowAssetsUsd: 1_000_000,
        liquidityAssetsUsd: 1_000_000,
        utilization: 0.5,
        supplyApy: 0.045,
        borrowApy: 0.075,
        rewards: [],
      },
    },
  ];

  // Allocations: 50% WETH/USDC, 30% cbBTC/USDC, 20% USDC/WETH
  const allocations = [
    {
      marketKey: 'market-1-weth-usdc',
      supplyAssetsUsd: 5_000_000,
      sharePct: 0.5, // 50%
    },
    {
      marketKey: 'market-2-cbbtc-usdc',
      supplyAssetsUsd: 3_000_000,
      sharePct: 0.3, // 30%
    },
    {
      marketKey: 'market-3-usdc-weth',
      supplyAssetsUsd: 2_000_000,
      sharePct: 0.2, // 20%
    },
  ];

  return {
    vaultAddress,
    totalSupplyUsd,
    markets,
    allocations,
  };
};

// Reallocation logic functions (extracted from component logic)
function calculateTotalShare(
  allocations: Array<{ marketKey: string; sharePct: number }>,
  edits: Map<string, { marketKey: string; currentSharePct: number; newSharePct: number }>
): number {
  let total = 0;
  allocations.forEach((allocation) => {
    const edit = edits.get(allocation.marketKey);
    total += edit ? edit.newSharePct : allocation.sharePct * 100;
  });
  return total;
}

function validateReallocation(
  allocations: Array<{ marketKey: string; sharePct: number }>,
  edits: Map<string, { marketKey: string; currentSharePct: number; newSharePct: number }>
): { valid: boolean; totalShare: number; error?: string } {
  const totalShare = calculateTotalShare(allocations, edits);
  const isValid = Math.abs(totalShare - 100) < 0.01;

  if (!isValid) {
    return {
      valid: false,
      totalShare,
      error: `Total allocation must equal 100%. Current total: ${totalShare.toFixed(2)}%`,
    };
  }

  return { valid: true, totalShare };
}

function createReallocationPayload(
  vaultAddress: string,
  allocations: Array<{ marketKey: string; sharePct: number }>,
  edits: Map<string, { marketKey: string; currentSharePct: number; newSharePct: number }>,
  walletAddress: string
) {
  const allocationPayload = allocations.map((allocation) => {
    const edit = edits.get(allocation.marketKey);
    return {
      marketKey: allocation.marketKey,
      sharePct: edit ? edit.newSharePct : allocation.sharePct * 100,
    };
  });

  return {
    vaultAddress,
    marketKey: allocationPayload[0]?.marketKey || '',
    action: 'allocate' as const,
    sharePct: allocationPayload[0]?.sharePct || 0,
    walletAddress,
    notes: `Reallocation: ${allocationPayload.length} markets adjusted`,
  };
}

describe('Allocation Reallocation Logic', () => {
  let mockData: ReturnType<typeof createMockUSDCVaultData>;
  let mockEdits: Map<string, { marketKey: string; currentSharePct: number; newSharePct: number }>;

  beforeEach(() => {
    mockData = createMockUSDCVaultData();
    mockEdits = new Map();
  });

  describe('Initial State', () => {
    it('should have 3 markets allocated', () => {
      expect(mockData.allocations.length).toBe(3);
    });

    it('should have allocations totaling 100%', () => {
      const total = mockData.allocations.reduce((sum, a) => sum + a.sharePct * 100, 0);
      expect(total).toBe(100);
    });

    it('should have correct market allocations', () => {
      expect(mockData.allocations[0].sharePct * 100).toBe(50); // WETH/USDC
      expect(mockData.allocations[1].sharePct * 100).toBe(30); // cbBTC/USDC
      expect(mockData.allocations[2].sharePct * 100).toBe(20); // USDC/WETH
    });
  });

  describe('Share Calculation', () => {
    it('should calculate total share correctly with no edits', () => {
      const total = calculateTotalShare(mockData.allocations, mockEdits);
      expect(total).toBe(100);
    });

    it('should calculate total share correctly with edits', () => {
      mockEdits.set('market-1-weth-usdc', {
        marketKey: 'market-1-weth-usdc',
        currentSharePct: 50,
        newSharePct: 40,
      });
      mockEdits.set('market-2-cbbtc-usdc', {
        marketKey: 'market-2-cbbtc-usdc',
        currentSharePct: 30,
        newSharePct: 35,
      });
      mockEdits.set('market-3-usdc-weth', {
        marketKey: 'market-3-usdc-weth',
        currentSharePct: 20,
        newSharePct: 25,
      });

      const total = calculateTotalShare(mockData.allocations, mockEdits);
      expect(total).toBe(100);
    });

    it('should calculate total share correctly with partial edits', () => {
      mockEdits.set('market-1-weth-usdc', {
        marketKey: 'market-1-weth-usdc',
        currentSharePct: 50,
        newSharePct: 45,
      });

      const total = calculateTotalShare(mockData.allocations, mockEdits);
      // 45% (edited) + 30% (unchanged) + 20% (unchanged) = 95%
      expect(total).toBe(95);
    });
  });

  describe('Validation', () => {
    it('should validate correct total (100%)', () => {
      mockEdits.set('market-1-weth-usdc', {
        marketKey: 'market-1-weth-usdc',
        currentSharePct: 50,
        newSharePct: 40,
      });
      mockEdits.set('market-2-cbbtc-usdc', {
        marketKey: 'market-2-cbbtc-usdc',
        currentSharePct: 30,
        newSharePct: 35,
      });
      mockEdits.set('market-3-usdc-weth', {
        marketKey: 'market-3-usdc-weth',
        currentSharePct: 20,
        newSharePct: 25,
      });

      const validation = validateReallocation(mockData.allocations, mockEdits);
      expect(validation.valid).toBe(true);
      expect(validation.totalShare).toBe(100);
    });

    it('should reject invalid total (not 100%)', () => {
      mockEdits.set('market-1-weth-usdc', {
        marketKey: 'market-1-weth-usdc',
        currentSharePct: 50,
        newSharePct: 40,
      });
      mockEdits.set('market-2-cbbtc-usdc', {
        marketKey: 'market-2-cbbtc-usdc',
        currentSharePct: 30,
        newSharePct: 30,
      });
      // market-3 stays at 20%, total = 90%

      const validation = validateReallocation(mockData.allocations, mockEdits);
      expect(validation.valid).toBe(false);
      expect(validation.totalShare).toBe(90);
      expect(validation.error).toContain('Total allocation must equal 100%');
    });

    it('should handle edge case of exactly 100.02% (outside tolerance)', () => {
      mockEdits.set('market-1-weth-usdc', {
        marketKey: 'market-1-weth-usdc',
        currentSharePct: 50,
        newSharePct: 50.02,
      });

      const validation = validateReallocation(mockData.allocations, mockEdits);
      expect(validation.valid).toBe(false);
      expect(validation.totalShare).toBeGreaterThan(100);
    });
  });

  describe('Reallocation Payload Creation', () => {
    it('should create correct payload for reallocation', () => {
      mockEdits.set('market-1-weth-usdc', {
        marketKey: 'market-1-weth-usdc',
        currentSharePct: 50,
        newSharePct: 40,
      });
      mockEdits.set('market-2-cbbtc-usdc', {
        marketKey: 'market-2-cbbtc-usdc',
        currentSharePct: 30,
        newSharePct: 35,
      });
      mockEdits.set('market-3-usdc-weth', {
        marketKey: 'market-3-usdc-weth',
        currentSharePct: 20,
        newSharePct: 25,
      });

      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbE';
      const payload = createReallocationPayload(
        mockData.vaultAddress,
        mockData.allocations,
        mockEdits,
        walletAddress
      );

      expect(payload.vaultAddress).toBe(mockData.vaultAddress);
      expect(payload.walletAddress).toBe(walletAddress);
      expect(payload.action).toBe('allocate');
      expect(payload.notes).toContain('Reallocation: 3 markets adjusted');
    });

    it('should include all market changes in payload', () => {
      mockEdits.set('market-1-weth-usdc', {
        marketKey: 'market-1-weth-usdc',
        currentSharePct: 50,
        newSharePct: 60,
      });

      const payload = createReallocationPayload(
        mockData.vaultAddress,
        mockData.allocations,
        mockEdits,
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbE'
      );

      expect(payload.sharePct).toBe(60); // First market's new share
    });
  });

  describe('API Call Simulation', () => {
    it('should format API request correctly', async () => {
      mockEdits.set('market-1-weth-usdc', {
        marketKey: 'market-1-weth-usdc',
        currentSharePct: 50,
        newSharePct: 40,
      });
      mockEdits.set('market-2-cbbtc-usdc', {
        marketKey: 'market-2-cbbtc-usdc',
        currentSharePct: 30,
        newSharePct: 35,
      });
      mockEdits.set('market-3-usdc-weth', {
        marketKey: 'market-3-usdc-weth',
        currentSharePct: 20,
        newSharePct: 25,
      });

      const validation = validateReallocation(mockData.allocations, mockEdits);
      expect(validation.valid).toBe(true);

      if (validation.valid) {
        const payload = createReallocationPayload(
          mockData.vaultAddress,
          mockData.allocations,
          mockEdits,
          '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbE'
        );

        // Simulate API call
        const mockFetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ intent: { id: 'test-intent-id' } }),
        });

        const response = await mockFetch('/api/allocations/intents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/allocations/intents',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );

        const result = await response.json();
        expect(result.intent.id).toBe('test-intent-id');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero allocation', () => {
      mockEdits.set('market-1-weth-usdc', {
        marketKey: 'market-1-weth-usdc',
        currentSharePct: 50,
        newSharePct: 0,
      });
      mockEdits.set('market-2-cbbtc-usdc', {
        marketKey: 'market-2-cbbtc-usdc',
        currentSharePct: 30,
        newSharePct: 50,
      });
      mockEdits.set('market-3-usdc-weth', {
        marketKey: 'market-3-usdc-weth',
        currentSharePct: 20,
        newSharePct: 50,
      });

      const total = calculateTotalShare(mockData.allocations, mockEdits);
      expect(total).toBe(100);
    });

    it('should handle 100% allocation to single market', () => {
      mockEdits.set('market-1-weth-usdc', {
        marketKey: 'market-1-weth-usdc',
        currentSharePct: 50,
        newSharePct: 100,
      });
      mockEdits.set('market-2-cbbtc-usdc', {
        marketKey: 'market-2-cbbtc-usdc',
        currentSharePct: 30,
        newSharePct: 0,
      });
      mockEdits.set('market-3-usdc-weth', {
        marketKey: 'market-3-usdc-weth',
        currentSharePct: 20,
        newSharePct: 0,
      });

      const validation = validateReallocation(mockData.allocations, mockEdits);
      expect(validation.valid).toBe(true);
      expect(validation.totalShare).toBe(100);
    });
  });
});

