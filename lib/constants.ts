/**
 * Application Constants
 * Centralized constants to avoid magic numbers throughout the codebase
 */

// Network Configuration
export const BASE_CHAIN_ID = 8453;
export const BASE_CHAIN_NAME = 'Base';

// Performance Fee Configuration
export const DEFAULT_PERFORMANCE_FEE_BPS = 200; // 2%

// GraphQL Query Limits
export const GRAPHQL_FIRST_LIMIT = 1000;
export const GRAPHQL_TRANSACTIONS_LIMIT = 10;

// Time Constants (in milliseconds)
export const MILLISECONDS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const DAYS_PER_WEEK = 7;

export const SECOND_MS = MILLISECONDS_PER_SECOND;
export const MINUTE_MS = SECOND_MS * SECONDS_PER_MINUTE;
export const HOUR_MS = MINUTE_MS * MINUTES_PER_HOUR;
export const DAY_MS = HOUR_MS * HOURS_PER_DAY;
export const WEEK_MS = DAY_MS * DAYS_PER_WEEK;

// Common time periods
export const DAYS_30_MS = 30 * DAY_MS;
export const DAYS_30_SECONDS = 30 * HOURS_PER_DAY * SECONDS_PER_MINUTE;
export const DAYS_90_MS = 90 * DAY_MS;

// API Configuration
export const MORPHO_GRAPHQL_ENDPOINT = process.env.MORPHO_GRAPHQL_ENDPOINT || process.env.MORPHO_API_URL || 'https://api.morpho.org/graphql';

// React Query Configuration
export const QUERY_STALE_TIME_SHORT = 2 * MINUTE_MS; // 2 minutes
export const QUERY_STALE_TIME_MEDIUM = 5 * MINUTE_MS; // 5 minutes
export const QUERY_STALE_TIME_LONG = 30 * MINUTE_MS; // 30 minutes

export const QUERY_REFETCH_INTERVAL_SHORT = 2 * MINUTE_MS;
export const QUERY_REFETCH_INTERVAL_MEDIUM = 5 * MINUTE_MS;

// Request Timeouts
export const API_REQUEST_TIMEOUT_MS = 30000; // 30 seconds
export const EXTERNAL_API_TIMEOUT_MS = 60000; // 60 seconds

// Rate Limiting
export const RATE_LIMIT_REQUESTS_PER_MINUTE = 60;
export const RATE_LIMIT_REQUESTS_PER_HOUR = 1000;

// Fee Splitter Addresses
export const FEE_SPLITTER_V1 = '0x194DeC45D34040488f355823e1F94C0434304188' as const;
export const FEE_SPLITTER_V2 = '0x3690Eb8735fE51c695d2f2Da289D1FA447137E24' as const;

// Helper functions
export const getDaysAgo = (days: number): Date => {
  return new Date(Date.now() - days * DAY_MS);
};

export const getDaysAgoTimestamp = (days: number): number => {
  return Math.floor((Date.now() - days * DAY_MS) / MILLISECONDS_PER_SECOND);
};




