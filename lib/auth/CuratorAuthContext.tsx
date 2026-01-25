'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  clearCuratorAuthCache,
  isCuratorAuthCacheValid,
  readCuratorAuthCache,
  writeCuratorAuthCache,
} from './curator-auth';

type CuratorAuthContextValue = {
  isAuthenticated: boolean;
  isReady: boolean;
  login: (password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
};

const CuratorAuthContext = createContext<CuratorAuthContextValue | null>(null);

export function useCuratorAuth(): CuratorAuthContextValue {
  const ctx = useContext(CuratorAuthContext);
  if (!ctx) {
    throw new Error('useCuratorAuth must be used within CuratorAuthProvider');
  }
  return ctx;
}

export function CuratorAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const cache = readCuratorAuthCache();
    if (isCuratorAuthCacheValid(cache)) {
      setIsAuthenticated(true);
    } else {
      if (cache) clearCuratorAuthCache();
      setIsAuthenticated(false);
    }
    setIsReady(true);
  }, []);

  const login = useCallback(async (password: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok === true) {
      writeCuratorAuthCache();
      setIsAuthenticated(true);
      return { ok: true };
    }
    return { ok: false, error: (data?.error as string) || 'Invalid password' };
  }, []);

  const logout = useCallback(() => {
    clearCuratorAuthCache();
    setIsAuthenticated(false);
  }, []);

  const value = useMemo<CuratorAuthContextValue>(
    () => ({ isAuthenticated, isReady, login, logout }),
    [isAuthenticated, isReady, login, logout]
  );

  return (
    <CuratorAuthContext.Provider value={value}>
      {children}
    </CuratorAuthContext.Provider>
  );
}
