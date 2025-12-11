'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Shield } from 'lucide-react';
import { vaults } from '@/lib/config/vaults';

const navBase = [{ label: 'Overview', href: '/', icon: Shield }];

export function Sidebar() {
  const pathname = usePathname();
  const v2Vaults = vaults.filter((v) => v.version === 'v2');
  const v1Vaults = vaults.filter((v) => v.version === 'v1');

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white/90 p-4 backdrop-blur flex flex-col">
      <Link
        href="/"
        className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900"
      >
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
          M
        </span>
        Curator
      </Link>

      <button className="mb-6 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800">
        <Plus className="h-4 w-4" />
        Create Vault
      </button>

      <nav className="space-y-6 text-sm">
        <div className="space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Explore
          </p>
          {navBase.map((item) => (
            <Link
              key={item.href}
              href={item.href}
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
            V2 Vaults
          </p>
          <div className="space-y-1">
            {v2Vaults.map((vault) => (
              <Link
                key={vault.id}
                href={`/vaults/${vault.address}`}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100 ${
                  isActive(`/vaults/${vault.address}`) ? 'bg-slate-900 text-white' : ''
                }`}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                  {vault.asset.slice(0, 1)}
                </span>
                <span className="truncate">{vault.name}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            V1 Vaults
          </p>
          <div className="space-y-1">
            {v1Vaults.map((vault) => (
              <Link
                key={vault.id}
                href={`/vaults/${vault.address}`}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 text-slate-700 transition hover:bg-slate-100 ${
                  isActive(`/vaults/${vault.address}`) ? 'bg-slate-900 text-white' : ''
                }`}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                  {vault.asset.slice(0, 1)}
                </span>
                <span className="truncate">{vault.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        Resources
      </div>
    </aside>
  );
}
