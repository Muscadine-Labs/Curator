'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useEffect } from 'react';

export function WalletConnect() {
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/12c6e062-52e2-470f-b399-c937a41c73e1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/WalletConnect.tsx:8',message:'WalletConnect component mounted',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  }, []);
  // #endregion
  
  return <ConnectButton />;
}

