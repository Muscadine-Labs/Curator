'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { base } from 'viem/chains';

// #region agent log
if (typeof window !== 'undefined') {
  fetch('http://127.0.0.1:7242/ingest/12c6e062-52e2-470f-b399-c937a41c73e1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/wallet/config.ts:10',message:'WalletConnect projectId check',data:{projectId:process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',hasEnvVar:!!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
}
// #endregion

// Create wagmi config with RainbowKit
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo';

// #region agent log
if (typeof window !== 'undefined') {
  fetch('http://127.0.0.1:7242/ingest/12c6e062-52e2-470f-b399-c937a41c73e1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/wallet/config.ts:18',message:'Creating wagmi config',data:{projectId,appName:'Muscadine Curator',chainId:base.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
}
// #endregion

const config = getDefaultConfig({
  appName: 'Muscadine Curator',
  projectId,
  chains: [base],
  ssr: true,
  transports: {
    [base.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
        ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
        : `https://base-mainnet.g.alchemy.com/v2/demo` // Fallback for build
    ),
  },
});

// #region agent log
if (typeof window !== 'undefined') {
  fetch('http://127.0.0.1:7242/ingest/12c6e062-52e2-470f-b399-c937a41c73e1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/wallet/config.ts:32',message:'Config created successfully',data:{hasConfig:!!config},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
}
// #endregion

export { config };
