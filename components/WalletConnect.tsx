'use client';

import { useAccount, useDisconnect } from 'wagmi';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { formatAddress } from '@/lib/format/number';
import { Badge } from '@/components/ui/badge';

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  if (!isConnected || !address) {
    return <ConnectWallet />;
  }

  // Show connected wallet address with disconnect button
  // Using fallback to avoid IdentityCard client-side errors if OnchainKitProvider isn't configured
  return (
    <div className="flex items-center gap-3">
      <Badge variant="secondary" className="font-mono text-xs">
        {formatAddress(address)}
      </Badge>
      <Button
        variant="outline"
        size="sm"
        onClick={() => disconnect()}
        className="flex items-center gap-2"
      >
        <LogOut className="h-4 w-4" />
        Disconnect
      </Button>
    </div>
  );
}

