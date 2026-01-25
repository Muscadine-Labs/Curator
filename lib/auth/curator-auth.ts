/**
 * Curator/Business auth: password verification and cached session.
 * Cache is invalidated when NEXT_PUBLIC_CURATOR_AUTH_VERSION or password changes (deploy).
 */

const CACHE_KEY = 'curator_auth';

export type CuratorAuthCache = { v: string; ok: true };

function getVersion(): string {
  return typeof process.env.NEXT_PUBLIC_CURATOR_AUTH_VERSION === 'string'
    ? process.env.NEXT_PUBLIC_CURATOR_AUTH_VERSION
    : '1';
}

export function readCuratorAuthCache(): CuratorAuthCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const p = parsed as Record<string, unknown> | null;
    if (p && typeof p === 'object' && typeof p['v'] === 'string' && p['ok'] === true) {
      return { v: p['v'], ok: true } as CuratorAuthCache;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCuratorAuthCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CuratorAuthCache = { v: getVersion(), ok: true };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function clearCuratorAuthCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

export function isCuratorAuthCacheValid(cache: CuratorAuthCache | null): boolean {
  if (!cache || !cache.ok) return false;
  return cache.v === getVersion();
}
