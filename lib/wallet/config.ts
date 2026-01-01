'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { getDefaultWallets } from '@rainbow-me/rainbowkit';
import { rabbyWallet } from '@rainbow-me/rainbowkit/wallets';
import { http, createStorage } from 'wagmi';
import { base, mainnet, optimism, polygon } from 'viem/chains';

// Create wagmi config with RainbowKit
// Allow build-time to proceed without env vars (they'll be required at runtime)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || (process.env.NODE_ENV === 'production' ? '' : 'demo');
if (!projectId && process.env.NODE_ENV === 'production') {
  throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID environment variable is required');
}

// Get default wallets and add Rabby
const { wallets } = getDefaultWallets({
  appName: 'Muscadine Curator',
  projectId,
});

// Add Rabby to the wallets list (as a new group)
const walletsWithRabby = [
  ...wallets,
  {
    groupName: 'More',
    wallets: [rabbyWallet],
  },
];

// Supported chains: Base (default), Ethereum, Optimism, Polygon
const chains = [base, mainnet, optimism, polygon] as const;

// Helper to get RPC URL for a chain
function getRpcUrl(chainId: number): string {
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (!alchemyKey) {
    // Fallback to public RPCs if no Alchemy key
    switch (chainId) {
      case base.id:
        return 'https://base-mainnet.g.alchemy.com/v2/demo';
      case mainnet.id:
        return 'https://eth-mainnet.g.alchemy.com/v2/demo';
      case optimism.id:
        return 'https://opt-mainnet.g.alchemy.com/v2/demo';
      case polygon.id:
        return 'https://polygon-mainnet.g.alchemy.com/v2/demo';
      default:
        return 'https://base-mainnet.g.alchemy.com/v2/demo';
    }
  }

  // Use Alchemy for all chains if key is available
  switch (chainId) {
    case base.id:
      return `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    case mainnet.id:
      return `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    case optimism.id:
      return `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    case polygon.id:
      return `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    default:
      return `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  }
}

// Create a no-op storage that doesn't persist connections
// This prevents auto-reconnect since there's no stored connection state
const noOpStorage = createStorage({
  storage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
});

const config = getDefaultConfig({
  appName: 'Muscadine Curator',
  projectId,
  chains,
  ssr: true,
  wallets: walletsWithRabby,
  transports: {
    [base.id]: http(getRpcUrl(base.id)),
    [mainnet.id]: http(getRpcUrl(mainnet.id)),
    [optimism.id]: http(getRpcUrl(optimism.id)),
    [polygon.id]: http(getRpcUrl(polygon.id)),
  },
  storage: noOpStorage,
  // Disable automatic wallet detection and connection (prevents Base wallet popup)
  multiInjectedProviderDiscovery: false,
});

export { config };
