/**
 * Application Constants
 * Centralized constants to avoid magic numbers throughout the codebase
 */

// Network Configuration
export const ETHEREUM_CHAIN_ID = 1;
export const BASE_CHAIN_ID = 8453;
export const BASE_CHAIN_NAME = 'Base';

// Networks for sidebar (order: Ethereum, Base)
export const SIDEBAR_NETWORKS = [
  { chainId: ETHEREUM_CHAIN_ID, name: 'Ethereum' },
  { chainId: BASE_CHAIN_ID, name: 'Base' },
] as const;

// Block Explorer URLs
export const ETHEREUM_SCAN_URL = 'https://etherscan.io';
export const BASE_SCAN_URL = 'https://basescan.org';

const CHAIN_SCAN_URLS: Record<number, string> = {
  [ETHEREUM_CHAIN_ID]: ETHEREUM_SCAN_URL,
  [BASE_CHAIN_ID]: BASE_SCAN_URL,
};

/** Returns block explorer base URL for a chain. Falls back to Base if unknown. */
export function getScanUrlForChain(chainId: number): string {
  return CHAIN_SCAN_URLS[chainId] ?? BASE_SCAN_URL;
}

/** Returns block explorer display name for a chain (e.g. "Etherscan", "Basescan"). */
export function getScanNameForChain(chainId: number): string {
  return chainId === ETHEREUM_CHAIN_ID ? 'Etherscan' : 'Basescan';
}

// Fee conversion (decimal 0–1 to basis points)
export const BPS_PER_ONE = 10000;

// GraphQL Query Limits
export const GRAPHQL_FIRST_LIMIT = 1000;
export const GRAPHQL_TRANSACTIONS_LIMIT = 10;

// Time Constants (in milliseconds)
export const MILLISECONDS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;

export const SECOND_MS = MILLISECONDS_PER_SECOND;
export const MINUTE_MS = SECOND_MS * SECONDS_PER_MINUTE;
export const HOUR_MS = MINUTE_MS * MINUTES_PER_HOUR;
export const DAY_MS = HOUR_MS * HOURS_PER_DAY;

// Common time periods
export const DAYS_30_MS = 30 * DAY_MS;

// API Configuration
export const MORPHO_GRAPHQL_ENDPOINT = 'https://api.morpho.org/graphql';

// Request Timeouts
export const EXTERNAL_API_TIMEOUT_MS = 60000; // 60 seconds

// Rate Limiting
export const RATE_LIMIT_REQUESTS_PER_MINUTE = 60;

// Helper functions
export const getDaysAgo = (days: number): Date => {
  return new Date(Date.now() - days * DAY_MS);
};

export const getDaysAgoTimestamp = (days: number): number => {
  return Math.floor((Date.now() - days * DAY_MS) / MILLISECONDS_PER_SECOND);
};
