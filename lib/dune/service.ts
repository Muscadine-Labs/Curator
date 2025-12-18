/**
 * Dune Analytics API Service
 * 
 * This service handles communication with Dune Analytics API v1
 * Documentation: https://docs.dune.com/api-reference
 */

import { fetchExternalApi } from '@/lib/utils/fetch-with-timeout';

// Dune API Configuration (only used in this service)
const DUNE_API_BASE = 'https://api.dune.com/api/v1';
const DUNE_MAX_WAIT_TIME_MS = 120000; // 2 minutes
const DUNE_POLL_INTERVAL_MS = 2000; // 2 seconds

export interface DuneQueryResult {
  execution_id: string;
  state: 'QUERY_STATE_PENDING' | 'QUERY_STATE_EXECUTING' | 'QUERY_STATE_COMPLETED' | 'QUERY_STATE_FAILED';
  submitted_at: string;
  expires_at: string;
  execution_started_at?: string;
  execution_ended_at?: string;
}

export interface DuneRow {
  [key: string]: string | number | boolean | null | undefined;
}

export interface DuneExecutionResult {
  execution_id: string;
  state: string;
  submitted_at: string;
  expires_at: string;
  execution_started_at?: string;
  execution_ended_at?: string;
  result?: {
    rows: Array<DuneRow>;
    metadata: {
      column_names: string[];
      result_set_bytes: number;
      total_row_count: number;
      datapoint_count: number;
      pending_time_millis: number;
      execution_time_millis: number;
    };
  };
}

export interface DuneQueryParams {
  [key: string]: string | number | boolean;
}

/**
 * Execute a Dune query with optional parameters
 */
export async function executeDuneQuery(
  queryId: number,
  parameters?: DuneQueryParams
): Promise<DuneQueryResult> {
  const apiKey = process.env.DUNE_API_KEY;
  if (!apiKey) {
    throw new Error('DUNE_API_KEY environment variable is not set');
  }

  const url = `${DUNE_API_BASE}/query/${queryId}/execute`;
  const body: { query_parameters?: DuneQueryParams } = {};
  
  if (parameters) {
    body.query_parameters = parameters;
  }

  const response = await fetchExternalApi(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dune-API-Key': apiKey,
    },
    body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dune API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Get the results of a Dune query execution
 */
export async function getDuneQueryResults(executionId: string): Promise<DuneExecutionResult> {
  const apiKey = process.env.DUNE_API_KEY;
  if (!apiKey) {
    throw new Error('DUNE_API_KEY environment variable is not set');
  }

  const url = `${DUNE_API_BASE}/execution/${executionId}/results`;
  
  const response = await fetchExternalApi(url, {
    method: 'GET',
    headers: {
      'X-Dune-API-Key': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dune API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Execute a query and wait for results (with polling)
 */
export async function executeDuneQueryAndWait(
  queryId: number,
  parameters?: DuneQueryParams,
  maxWaitTime = DUNE_MAX_WAIT_TIME_MS,
  pollInterval = DUNE_POLL_INTERVAL_MS
): Promise<DuneExecutionResult> {
  // Execute the query
  const execution = await executeDuneQuery(queryId, parameters);
  const executionId = execution.execution_id;

  // Poll for results
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitTime) {
    const result = await getDuneQueryResults(executionId);
    
    if (result.state === 'QUERY_STATE_COMPLETED') {
      return result;
    }
    
    if (result.state === 'QUERY_STATE_FAILED') {
      throw new Error(`Dune query execution failed: ${executionId}`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Dune query execution timed out after ${maxWaitTime}ms`);
}

/**
 * Get the latest results for a query (if it was recently executed)
 * This is faster than executing and waiting, but may return stale data
 */
export async function getLatestDuneQueryResults(
  queryId: number,
  parameters?: DuneQueryParams
): Promise<DuneExecutionResult | null> {
  try {
    // Try to get the latest execution first
    const apiKey = process.env.DUNE_API_KEY;
    if (!apiKey) {
      throw new Error('DUNE_API_KEY environment variable is not set');
    }

    const url = `${DUNE_API_BASE}/query/${queryId}/results`;
    const searchParams = new URLSearchParams();
    
    if (parameters) {
      Object.entries(parameters).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
    }

    const fullUrl = searchParams.toString() 
      ? `${url}?${searchParams.toString()}`
      : url;

    const response = await fetchExternalApi(fullUrl, {
      method: 'GET',
      headers: {
        'X-Dune-API-Key': apiKey,
      },
    });

    if (response.status === 404) {
      // No recent results, need to execute
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dune API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch {
    // If getting latest fails, return null to trigger execution
    return null;
  }
}

