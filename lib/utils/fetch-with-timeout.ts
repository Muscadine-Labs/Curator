/**
 * Fetch with timeout utility
 */

import { API_REQUEST_TIMEOUT_MS, EXTERNAL_API_TIMEOUT_MS } from '@/lib/constants';

/**
 * Create an AbortController with timeout
 * Returns controller and cleanup function to clear timeout
 */
function createTimeoutController(timeoutMs: number): { controller: AbortController; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  return {
    controller,
    cleanup: () => clearTimeout(timeoutId),
  };
}

/**
 * Fetch with timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = API_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const { controller, cleanup } = createTimeoutController(timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    // Clear timeout if request completes before timeout
    cleanup();
    return response;
  } catch (error) {
    // Always cleanup on error
    cleanup();
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

