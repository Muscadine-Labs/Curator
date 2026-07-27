'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { cn } from '@/lib/utils';

type ConnectWalletButtonProps = {
  className?: string;
  /** Full-width layout for account sheet / mobile. */
  fullWidth?: boolean;
};

/** RainbowKit wallet controls (chain status hidden — app network is separate). */
export function ConnectWalletButton({
  className,
  fullWidth = false,
}: ConnectWalletButtonProps) {
  return (
    <div className={cn(fullWidth && 'w-full [&_button]:w-full', className)}>
      <ConnectButton
        showBalance={false}
        chainStatus="none"
        accountStatus={fullWidth ? 'full' : 'address'}
      />
    </div>
  );
}
