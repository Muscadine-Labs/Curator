'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, X, Bot } from 'lucide-react';
import { getVaultCategory, shouldUseV2Query } from '@/lib/config/vaults';
import { useVaultList } from '@/lib/hooks/useProtocolStats';
import { Button } from '@/components/ui/button';

const navBase = [{ label: 'Overview', href: '/', icon: Shield }];

type SidebarProps = {
  onClose?: () => void;
};

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
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
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white/90 p-4 backdrop-blur">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          onClick={handleLinkClick}
          className="flex items-center gap-2 text-lg font-semibold text-slate-900"
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
            className="lg:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <nav className="space-y-6 text-sm">
        <div className="space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Explore
          </p>
          {navBase.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 transition ${
                isActive(item.href)
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>

        <div className="space-y-2">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            V2 Vineyard Vaults
          </p>
          <div className="space-y-1">
            {isLoading ? (
              <div className="px-2 py-2 text-slate-500">Loading...</div>
            ) : vineyardVaults.length === 0 ? (
              <div className="px-2 py-2 text-slate-500 text-xs">No vaults</div>
            ) : (
              vineyardVaults.map((vault) => {
                const useV2Route = shouldUseV2Query(vault.name);
                return (
                  <Link
                    key={vault.address}
                    href={`/vault/${useV2Route ? 'v2' : 'v1'}/${vault.address}`}
                    onClick={handleLinkClick}
                    className={`flex items-center gap-2 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100 ${
                      isActive(`/vault/${useV2Route ? 'v2' : 'v1'}/${vault.address}`) ? 'bg-slate-900 text-white' : ''
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
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            V2 Prime Vaults
          </p>
          <div className="space-y-1">
            {isLoading ? (
              <div className="px-2 py-2 text-slate-500">Loading...</div>
            ) : primeVaults.length === 0 ? (
              <div className="px-2 py-2 text-slate-500 text-xs">No vaults</div>
            ) : (
              primeVaults.map((vault) => {
                const useV2Route = shouldUseV2Query(vault.name);
                return (
                  <Link
                    key={vault.address}
                    href={`/vault/${useV2Route ? 'v2' : 'v1'}/${vault.address}`}
                    onClick={handleLinkClick}
                    className={`flex items-center gap-2 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100 ${
                      isActive(`/vault/${useV2Route ? 'v2' : 'v1'}/${vault.address}`) ? 'bg-slate-900 text-white' : ''
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
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            V1 Vaults
          </p>
          <div className="space-y-1">
            {isLoading ? (
              <div className="px-2 py-2 text-slate-500">Loading...</div>
            ) : v1Vaults.length === 0 ? (
              <div className="px-2 py-2 text-slate-500 text-xs">No vaults</div>
            ) : (
              v1Vaults.map((vault) => (
                <Link
                  key={vault.address}
                  href={`/vault/v1/${vault.address}`}
                  onClick={handleLinkClick}
                  className={`flex items-center gap-2 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100 ${
                    isActive(`/vault/v1/${vault.address}`) ? 'bg-slate-900 text-white' : ''
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

        <div className="space-y-2">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Bots
          </p>
          <div className="space-y-1">
            <Link
              href="/bots/morpho-liquidation"
              onClick={handleLinkClick}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100 ${
                isActive('/bots/morpho-liquidation') ? 'bg-slate-900 text-white' : ''
              }`}
            >
              <Bot className="h-4 w-4" />
              <span className="truncate">Morpho Liquidation Bot</span>
            </Link>
            <Link
              href="/bots/morpho-allocation"
              onClick={handleLinkClick}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100 ${
                isActive('/bots/morpho-allocation') ? 'bg-slate-900 text-white' : ''
              }`}
            >
              <Bot className="h-4 w-4" />
              <span className="truncate">Morpho Allocation Bot</span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        Resources
      </div>
    </aside>
  );
}
