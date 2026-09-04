import { describe, expect, it } from 'vitest';
import {
  getConfiguredVaultDisplayName,
  withFeeWrapperLabel,
} from '@/lib/config/vaults';

const USDC_PRIME =
  process.env.NEXT_PUBLIC_VAULT_USDC_V2 || '0x89712980Cb434eF5aE4AB29349419eb976B0b496';
const USDC_PRIME_WRAPPER =
  process.env.NEXT_PUBLIC_VAULT_USDC_PRIME_WRAPPER ||
  '0x036A01eFdDC87F6634FFDE0533EE528b90fc7A45';

describe('withFeeWrapperLabel', () => {
  it('appends (wrapper) for configured fee-wrapper addresses', () => {
    expect(withFeeWrapperLabel('USDC Prime', USDC_PRIME_WRAPPER)).toBe(
      'USDC Prime (wrapper)'
    );
  });

  it('does not append (wrapper) for strategy vault addresses', () => {
    expect(withFeeWrapperLabel('Muscadine USDC Prime', USDC_PRIME)).toBe(
      'Muscadine USDC Prime'
    );
  });

  it('is idempotent when the suffix is already present', () => {
    expect(withFeeWrapperLabel('USDC Prime (wrapper)', USDC_PRIME_WRAPPER)).toBe(
      'USDC Prime (wrapper)'
    );
    expect(withFeeWrapperLabel('USDC Prime (Wrapper)', USDC_PRIME_WRAPPER)).toBe(
      'USDC Prime (Wrapper)'
    );
  });

  it('uses the fallback when the name is missing', () => {
    expect(withFeeWrapperLabel(null, USDC_PRIME_WRAPPER)).toBe('Unknown Vault (wrapper)');
    expect(withFeeWrapperLabel('  ', USDC_PRIME_WRAPPER, 'Custom')).toBe('Custom (wrapper)');
  });
});

describe('getConfiguredVaultDisplayName', () => {
  it('includes (wrapper) for fee-wrapper config', () => {
    expect(
      getConfiguredVaultDisplayName({
        assetSymbol: 'USDC',
        listCategory: 'prime',
        kind: 'feeWrapper',
      })
    ).toBe('USDC Prime (wrapper)');
  });

  it('keeps the Muscadine prefix for strategy vaults', () => {
    expect(
      getConfiguredVaultDisplayName({
        assetSymbol: 'USDC',
        listCategory: 'prime',
        kind: 'strategy',
      })
    ).toBe('Muscadine USDC Prime');
  });
});
