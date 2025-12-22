'use client';

import { Menu } from 'lucide-react';
import { WalletConnect } from '@/components/WalletConnect';
import { NetworkSwitcher } from '@/components/NetworkSwitcher';
import { Button } from '@/components/ui/button';

type TopbarProps = {
  onMenuClick?: () => void;
};

export function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white/70 px-4 py-2 backdrop-blur sm:px-6 sm:py-3">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div className="text-xs font-medium text-slate-600 sm:text-sm">Muscadine Curator</div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <NetworkSwitcher />
        <WalletConnect />
      </div>
    </div>
  );
}
