'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { getDefaultWallets } from '@rainbow-me/rainbowkit';
import { rabbyWallet } from '@rainbow-me/rainbowkit/wallets';
import { http } from 'wagmi';
import { base } from 'viem/chains';

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

const config = getDefaultConfig({
  appName: 'Muscadine Curator',
  projectId,
  chains: [base],
  ssr: true,
  wallets: walletsWithRabby,
  transports: {
    [base.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
        ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
        : `https://base-mainnet.g.alchemy.com/v2/demo` // Fallback for build/dev (will fail at runtime if not set)
    ),
  },
});

export { config };
