'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, X, Bot, FileText, BookOpen } from 'lucide-react';
import { getVaultCategory, shouldUseV2Query } from '@/lib/config/vaults';
import { useVaultList } from '@/lib/hooks/useProtocolStats';
import { useCuratorAuth } from '@/lib/auth/CuratorAuthContext';
import { Button } from '@/components/ui/button';

const navBase = [
  { label: 'Overview', href: '/', icon: Shield },
];

type SidebarProps = {
  onClose?: () => void;
};

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { isAuthenticated } = useCuratorAuth();
  const { data: vaults = [], isLoading } = useVaultList();

  // Categorize vaults dynamically based on name
  const primeVaults = vaults.filter(v => getVaultCategory(v.name) === 'prime');
  const vineyardVaults = vaults.filter(v => getVaultCategory(v.name) === 'vineyard');
  const v1Vaults = vaults.filter(v => getVaultCategory(v.name) === 'v1');

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
        <Link
          href="/"
          onClick={handleLinkClick}
          className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
            M
          </span>
          Curator
        </Link>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] touch-manipulation lg:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-4 text-sm">
        <div className="space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Explore
          </p>
          {navBase.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick}
              className={`flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-2 transition ${
                isActive(item.href)
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>

        <div className="space-y-2">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            V2 Vineyard Vaults
          </p>
          <div className="space-y-1">
            {isLoading ? (
              <div className="px-2 py-2 text-slate-500 dark:text-slate-400">Loading...</div>
            ) : vineyardVaults.length === 0 ? (
              <div className="px-2 py-2 text-slate-500 text-xs dark:text-slate-400">No vaults</div>
            ) : (
              vineyardVaults.map((vault) => {
                const useV2Route = shouldUseV2Query(vault.name);
                return (
                  <Link
                    key={vault.address}
                    href={`/vault/${useV2Route ? 'v2' : 'v1'}/${vault.address}`}
                    onClick={handleLinkClick}
                    className={`flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${
                      isActive(`/vault/${useV2Route ? 'v2' : 'v1'}/${vault.address}`) ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''
                    }`}
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                      {(vault.asset ?? 'U').slice(0, 1)}
                    </span>
                    <span className="truncate">{vault.name ?? 'Unknown Vault'}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            V2 Prime Vaults
          </p>
          <div className="space-y-1">
            {isLoading ? (
              <div className="px-2 py-2 text-slate-500 dark:text-slate-400">Loading...</div>
            ) : primeVaults.length === 0 ? (
              <div className="px-2 py-2 text-slate-500 text-xs dark:text-slate-400">No vaults</div>
            ) : (
              primeVaults.map((vault) => {
                const useV2Route = shouldUseV2Query(vault.name);
                return (
                  <Link
                    key={vault.address}
                    href={`/vault/${useV2Route ? 'v2' : 'v1'}/${vault.address}`}
                    onClick={handleLinkClick}
                    className={`flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${
                      isActive(`/vault/${useV2Route ? 'v2' : 'v1'}/${vault.address}`) ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''
                    }`}
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                      {(vault.asset ?? 'U').slice(0, 1)}
                    </span>
                    <span className="truncate">{vault.name ?? 'Unknown Vault'}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            V1 Vaults
          </p>
          <div className="space-y-1">
            {isLoading ? (
              <div className="px-2 py-2 text-slate-500 dark:text-slate-400">Loading...</div>
            ) : v1Vaults.length === 0 ? (
              <div className="px-2 py-2 text-slate-500 text-xs dark:text-slate-400">No vaults</div>
            ) : (
              v1Vaults.map((vault) => (
                <Link
                  key={vault.address}
                  href={`/vault/v1/${vault.address}`}
                  onClick={handleLinkClick}
                  className={`flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${
                    isActive(`/vault/v1/${vault.address}`) ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''
                  }`}
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                    {(vault.asset ?? 'U').slice(0, 1)}
                  </span>
                  <span className="truncate">{vault.name ?? 'Unknown Vault'}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        {isAuthenticated && (
          <>
            <div className="space-y-2">
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Curator Tools
              </p>
              <div className="space-y-1">
                <Link
                  href="/curator/morpho"
                  onClick={handleLinkClick}
                  className={`flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${
                    isActive('/curator/morpho') ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  <span className="truncate">Morpho Curator</span>
                </Link>
                <Link
                  href="/curator/safe"
                  onClick={handleLinkClick}
                  className={`flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${
                    isActive('/curator/safe') ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  <span className="truncate">Multisig Safe</span>
                </Link>
                <Link
                  href="/curator/bots"
                  onClick={handleLinkClick}
                  className={`flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${
                    isActive('/curator/bots') ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''
                  }`}
                >
                  <Bot className="h-4 w-4" />
                  <span className="truncate">Morpho Automated Bots</span>
                </Link>
                <Link
                  href="/curator/eip-7702"
                  onClick={handleLinkClick}
                  className={`flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${
                    isActive('/curator/eip-7702') ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                  <span className="truncate">EIP-7702</span>
                </Link>
              </div>
            </div>

            <div className="space-y-2">
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Business
              </p>
              <div className="space-y-1">
                <Link
                  href="/overview/monthly-statement"
                  onClick={handleLinkClick}
                  className={`flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${
                    isActive('/overview/monthly-statement') ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  <span className="truncate">Monthly Statement</span>
                </Link>
              </div>
            </div>
          </>
        )}
      </nav>
    </aside>
  );
}
