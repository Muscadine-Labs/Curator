/**
 * Fetch with timeout utility
 */

import { API_REQUEST_TIMEOUT_MS, EXTERNAL_API_TIMEOUT_MS } from '@/lib/constants';

/**
 * Merge multiple AbortSignals and ensure timeout is cleared.
 */
function createMergedSignal(
  timeoutMs: number,
  externalSignal?: AbortSignal | null
): { signal: AbortSignal; cleanup: () => void } {
  // Prefer native timeout if available (Node 18+/modern runtimes)
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    const timeoutSignal = (AbortSignal as typeof AbortSignal & { timeout: (_ms: number) => AbortSignal }).timeout(timeoutMs);
    const signals = externalSignal ? [timeoutSignal, externalSignal] : [timeoutSignal];
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signals.forEach((sig) => {
      if (sig.aborted) {
        controller.abort();
      } else {
        sig.addEventListener("abort", onAbort, { once: true });
      }
    });
    const cleanup = () => signals.forEach((sig) => sig.removeEventListener("abort", onAbort));
    return { signal: controller.signal, cleanup };
  }

  // Fallback: manual timer
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let cleanup = () => clearTimeout(timeoutId);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      const onAbort = () => controller.abort();
      externalSignal.addEventListener("abort", onAbort, { once: true });
      const prevCleanup = cleanup;
      cleanup = () => {
        prevCleanup();
        externalSignal.removeEventListener("abort", onAbort);
      };
    }
  }

  return { signal: controller.signal, cleanup };
}

/**
 * Fetch with timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = API_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const { signal, cleanup } = createMergedSignal(timeoutMs, options.signal ?? undefined);

  try {
    const response = await fetch(url, {
      ...options,
      signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    cleanup();
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

