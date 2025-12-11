'use client';

import { WalletConnect } from '@/components/WalletConnect';
import { base } from 'viem/chains';

export function Topbar() {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white/70 px-6 py-3 backdrop-blur">
      <div className="text-sm font-medium text-slate-600">Muscadine Curator</div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Base • {base.name}
        </div>
        <WalletConnect />
      </div>
    </div>
  );
}
