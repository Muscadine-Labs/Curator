'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { NetworkSwitcher } from '@/components/NetworkSwitcher';
import { SignInSheet } from '@/components/SignInSheet';
import { useCuratorAuth } from '@/lib/auth/CuratorAuthContext';
import { Button } from '@/components/ui/button';
import { CURATOR_TOP_NAV, isTopNavActive } from '@/lib/nav/areas';
import { cn } from '@/lib/utils';

type TopbarProps = {
  onMenuClick?: () => void;
};

export function Topbar({ onMenuClick }: TopbarProps) {
  const { isAuthenticated } = useCuratorAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/70 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 sm:px-6 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {onMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px] shrink-0 touch-manipulation lg:hidden"
              onClick={onMenuClick}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <nav className="flex min-w-0 flex-wrap items-center gap-0.5 sm:gap-1">
            {CURATOR_TOP_NAV.map((item) => {
              const active = isTopNavActive(item.id, pathname);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-xs font-medium transition sm:px-2.5 sm:text-sm',
                    active
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <NetworkSwitcher />
          <ConnectWalletButton />
          <Button
            variant={isAuthenticated ? 'outline' : 'default'}
            size="sm"
            className="min-h-10 touch-manipulation"
            onClick={() => setSheetOpen(true)}
          >
            {isAuthenticated ? 'Account' : 'Sign in'}
          </Button>
        </div>
      </div>
      <SignInSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
