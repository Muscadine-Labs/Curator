'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useCuratorAuth, type UserRole } from '@/lib/auth/CuratorAuthContext';

type AppShellProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

function isBusinessPath(pathname: string): boolean {
  return pathname === '/overview/monthly-statement' || pathname === '/overview/muscadine-ledger';
}

function isCuratorPath(pathname: string): boolean {
  return pathname.startsWith('/curator/');
}

function canAccessPath(pathname: string, role: UserRole): boolean {
  // Public paths: overview (home) and vault pages
  if (pathname === '/' || pathname.startsWith('/vaults') || pathname.startsWith('/vault/')) {
    return true;
  }

  // Business paths require owner role
  if (isBusinessPath(pathname)) {
    return role === 'owner';
  }

  // Curator paths require any authenticated user (owner or intern)
  if (isCuratorPath(pathname)) {
    return role === 'owner' || role === 'intern';
  }

  // Default: allow access
  return true;
}

export function AppShell({ title, description, actions, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isReady, role } = useCuratorAuth();

  useEffect(() => {
    if (!isReady || !pathname) return;
    
    // Check if user has access to this path
    if (!canAccessPath(pathname, role)) {
      router.replace('/');
    }
  }, [pathname, role, isReady, router]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 touch-manipulation lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar - hidden on mobile, drawer on mobile when open */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-slate-200 bg-white/95 backdrop-blur transition-transform duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-900/95 lg:relative lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </aside>

        <div className="flex flex-1 flex-col lg:ml-0">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <header className="border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:px-6 sm:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 sm:text-2xl">{title}</h1>
                {description ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{description}</p>
                ) : null}
              </div>
              {actions ? (
                <div className="flex flex-wrap items-center gap-2">{actions}</div>
              ) : null}
            </div>
          </header>
          <main className="flex-1 overflow-y-auto px-4 pb-12 pt-4 sm:px-6 sm:pt-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
