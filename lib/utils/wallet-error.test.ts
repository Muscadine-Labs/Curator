import { describe, expect, it } from 'vitest';
import { isBroadcastTxHash, isWalletRejection } from '@/lib/utils/wallet-error';

const VALID_TX_HASH =
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

describe('isBroadcastTxHash', () => {
  it('returns false for empty or placeholder hashes', () => {
    expect(isBroadcastTxHash(null)).toBe(false);
    expect(isBroadcastTxHash(undefined)).toBe(false);
    expect(isBroadcastTxHash('')).toBe(false);
    expect(isBroadcastTxHash('0x')).toBe(false);
    expect(isBroadcastTxHash('0xabc')).toBe(false);
  });

  it('returns true for a full-length broadcast hash', () => {
    expect(isBroadcastTxHash(VALID_TX_HASH)).toBe(true);
  });
});

describe('isWalletRejection', () => {
  it('detects common wallet rejection messages', () => {
    expect(isWalletRejection(new Error('User rejected the request'))).toBe(true);
    expect(isWalletRejection(new Error('User denied transaction signature'))).toBe(true);
    expect(isWalletRejection(new Error('action_rejected'))).toBe(true);
    expect(isWalletRejection('Request rejected with code 4001')).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isWalletRejection(new Error('insufficient funds'))).toBe(false);
    expect(isWalletRejection(null)).toBe(false);
  });
});
