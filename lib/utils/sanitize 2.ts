/**
 * Input Sanitization Utilities
 */

import { isAddress } from 'viem';

/**
 * Sanitize string input - remove potentially dangerous characters
 */
export function sanitizeString(input: string | null | undefined, maxLength: number = 1000): string {
  if (!input) return '';
  
  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength);
  
  // Remove null bytes and control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized;
}

/**
 * Validate and sanitize Ethereum address
 */
export function sanitizeAddress(input: string | null | undefined): string | null {
  if (!input) return null;
  
  const trimmed = input.trim();
  
  // Validate address format
  if (!isAddress(trimmed)) {
    throw new Error('Invalid Ethereum address format');
  }
  
  return trimmed.toLowerCase();
}

/**
 * Sanitize number input
 */
export function sanitizeNumber(input: unknown, min?: number, max?: number): number | null {
  if (input === null || input === undefined) return null;
  
  const num = typeof input === 'number' ? input : Number(input);
  
  if (isNaN(num)) return null;
  
  if (min !== undefined && num < min) return min;
  if (max !== undefined && num > max) return max;
  
  return num;
}

/**
 * Sanitize notes/description text
 */
export function sanitizeNotes(input: string | null | undefined): string {
  return sanitizeString(input, 5000);
}

/**
 * Validate action type
 */
export function sanitizeAction(input: unknown): 'allocate' | 'deallocate' {
  if (input === 'allocate' || input === 'deallocate') {
    return input;
  }
  throw new Error('Action must be "allocate" or "deallocate"');
}




