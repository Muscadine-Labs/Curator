/**
 * Fetch with timeout utility
 */

import { API_REQUEST_TIMEOUT_MS, EXTERNAL_API_TIMEOUT_MS } from '@/lib/constants';

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  
  return controller;
}

/**
 * Fetch with timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = API_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = createTimeoutController(timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Fetch external API with longer timeout
 */
export async function fetchExternalApi(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetchWithTimeout(url, options, EXTERNAL_API_TIMEOUT_MS);
}

