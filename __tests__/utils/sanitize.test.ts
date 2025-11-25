/**
 * Tests for sanitization utilities
 * 
 * To run tests:
 * npm install --save-dev jest @types/jest ts-jest
 * npm test
 */

import { sanitizeString, sanitizeAddress, sanitizeNumber, sanitizeNotes, sanitizeAction } from '@/lib/utils/sanitize';

describe('sanitizeString', () => {
  it('should trim and limit length', () => {
    const input = '  hello world  ';
    const result = sanitizeString(input, 10);
    expect(result).toBe('hello worl');
  });

  it('should remove null bytes', () => {
    const input = 'hello\x00world';
    const result = sanitizeString(input);
    expect(result).toBe('helloworld');
  });

  it('should handle null/undefined', () => {
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
  });
});

describe('sanitizeAddress', () => {
  it('should validate and lowercase valid address', () => {
    const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbE';
    const result = sanitizeAddress(address);
    expect(result).toBe(address.toLowerCase());
  });

  it('should throw on invalid address', () => {
    expect(() => sanitizeAddress('invalid')).toThrow();
  });

  it('should return null for null/undefined', () => {
    expect(sanitizeAddress(null)).toBeNull();
    expect(sanitizeAddress(undefined)).toBeNull();
  });
});

describe('sanitizeNumber', () => {
  it('should parse valid numbers', () => {
    expect(sanitizeNumber('123')).toBe(123);
    expect(sanitizeNumber(456)).toBe(456);
  });

  it('should enforce min/max', () => {
    expect(sanitizeNumber(5, 10, 20)).toBe(10);
    expect(sanitizeNumber(25, 10, 20)).toBe(20);
    expect(sanitizeNumber(15, 10, 20)).toBe(15);
  });

  it('should return null for invalid input', () => {
    expect(sanitizeNumber('invalid')).toBeNull();
    expect(sanitizeNumber(null)).toBeNull();
  });
});

describe('sanitizeNotes', () => {
  it('should sanitize notes with max length', () => {
    const longNote = 'a'.repeat(10000);
    const result = sanitizeNotes(longNote);
    expect(result.length).toBeLessThanOrEqual(5000);
  });
});

describe('sanitizeAction', () => {
  it('should accept valid actions', () => {
    expect(sanitizeAction('allocate')).toBe('allocate');
    expect(sanitizeAction('deallocate')).toBe('deallocate');
  });

  it('should throw on invalid action', () => {
    expect(() => sanitizeAction('invalid')).toThrow();
  });
});

