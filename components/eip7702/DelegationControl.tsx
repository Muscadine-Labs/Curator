'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWalletClient, usePublicClient, useWaitForTransactionReceipt } from 'wagmi';
import { base } from 'viem/chains';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, ExternalLink, Shield } from 'lucide-react';
import { EIP7702_CONTRACTS } from '@/lib/eip7702/constants';
import { getDelegationStatus, isEOA } from '@/lib/eip7702/utils';
import { logger } from '@/lib/utils/logger';
import { formatAddress } from '@/lib/format/number';

export function DelegationControl() {
  const { address, isConnected, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  const [isDelegated, setIsDelegated] = useState<boolean | null>(null);
  const [implementation, setImplementation] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDelegating, setIsDelegating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash || undefined,
  });

  // Check if current chain is Base
  const isBaseChain = chain?.id === base.id;

  // Check delegation status
  const checkStatus = async () => {
    if (!address || !isConnected) return;

    setIsChecking(true);
    setError(null);

    try {
      const status = await getDelegationStatus(address, chain || base);
      setIsDelegated(status.isDelegated);
      setImplementation(status.implementation);
    } catch (err) {
      logger.error('Failed to check delegation status', err instanceof Error ? err : new Error(String(err)));
      setError('Failed to check delegation status');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      checkStatus();
    } else {
      setIsDelegated(null);
      setImplementation(null);
    }
  }, [address, isConnected, chain?.id]);

  // Handle delegation
  const handleDelegate = async () => {
    if (!walletClient || !address || !isConnected) {
      setError('Please connect your wallet');
      return;
    }

    if (!isBaseChain) {
      setError('Please switch to Base network');
      return;
    }

    setIsDelegating(true);
    setError(null);
    setTxHash(null);

    try {
      // Check if address is an EOA
      const isEoa = await isEOA(address, chain || base);
      if (!isEoa) {
        setError('This address is already a contract. EIP-7702 delegation is only for EOAs.');
        setIsDelegating(false);
        return;
      }

      // Check if account is available
      if (!walletClient.account) {
        throw new Error('Wallet account not available');
      }

      // Check account type - signAuthorization only works with local accounts
      const accountType = walletClient.account.type;
      if (accountType === 'json-rpc') {
        // Check if it's Base Account which might have better support
        const connector = walletClient.account.source;
        const isBaseAccount = connector === 'coinbaseWalletSDK' || connector === 'base';
        
        if (!isBaseAccount) {
          setError(
            'EIP-7702 delegation currently requires a local account (private key) or Base Account. ' +
            'Standard browser wallets (MetaMask, WalletConnect, etc.) do not yet support signing EIP-7702 authorizations through viem. ' +
            'Try using Base Account, or wait for wallet providers to add native EIP-7702 support. ' +
            'For more information, see: https://docs.cdp.coinbase.com/paymaster/need-to-knows/eip-7702-faqs'
          );
          setIsDelegating(false);
          return;
        }
        // Base Account might work, continue to try
      }

      // Sign authorization to delegate to EIP7702Proxy
      const authorization = await walletClient.signAuthorization({
        account: walletClient.account,
        contractAddress: EIP7702_CONTRACTS.PROXY_TEMPLATE,
      });

      // Send transaction with authorization
      const hash = await walletClient.sendTransaction({
        account: walletClient.account,
        to: address, // Send to self to apply authorization
        data: '0x', // Empty data for simple delegation
        authorizationList: [authorization],
      });

      setTxHash(hash);
      logger.info('Delegation transaction sent', { hash, address });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delegate';
      logger.error('Failed to delegate', err instanceof Error ? err : new Error(String(err)));
      
      // Provide more helpful error messages
      if (errorMessage.includes('json-rpc') || errorMessage.includes('not supported') || errorMessage.includes('Account type')) {
        setError(
          'EIP-7702 delegation currently requires a local account (private key) or Base Account. ' +
          'Your current wallet uses JSON-RPC which does not support signing EIP-7702 authorizations through viem. ' +
          'Try using Base Account (Coinbase Wallet), or wait for wallet providers to add native EIP-7702 support. ' +
          'For more information: https://docs.cdp.coinbase.com/paymaster/need-to-knows/eip-7702-faqs'
        );
      } else {
        setError(errorMessage);
      }
      setIsDelegating(false);
    }
  };

  // Handle revocation
  const handleRevoke = async () => {
    if (!walletClient || !address || !isConnected) {
      setError('Please connect your wallet');
      return;
    }

    if (!isBaseChain) {
      setError('Please switch to Base network');
      return;
    }

    setIsRevoking(true);
    setError(null);
    setTxHash(null);

    try {
      // Check if account is available
      if (!walletClient.account) {
        throw new Error('Wallet account not available');
      }

      // Check account type - signAuthorization only works with local accounts
      const accountType = walletClient.account.type;
      if (accountType === 'json-rpc') {
        // Check if it's Base Account which might have better support
        const connector = walletClient.account.source;
        const isBaseAccount = connector === 'coinbaseWalletSDK' || connector === 'base';
        
        if (!isBaseAccount) {
          setError(
            'EIP-7702 revocation currently requires a local account (private key) or Base Account. ' +
            'Standard browser wallets (MetaMask, WalletConnect, etc.) do not yet support signing EIP-7702 authorizations through viem. ' +
            'Try using Base Account, or wait for wallet providers to add native EIP-7702 support. ' +
            'For more information: https://docs.cdp.coinbase.com/paymaster/need-to-knows/eip-7702-faqs'
          );
          setIsRevoking(false);
          return;
        }
        // Base Account might work, continue to try
      }

      // Revoke by signing authorization to address(0)
      const authorization = await walletClient.signAuthorization({
        account: walletClient.account,
        contractAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      });

      // Send transaction with empty authorization to revoke
      const hash = await walletClient.sendTransaction({
        account: walletClient.account,
        to: address, // Send to self
        data: '0x', // Empty data
        authorizationList: [authorization],
      });

      setTxHash(hash);
      logger.info('Revocation transaction sent', { hash, address });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke';
      logger.error('Failed to revoke delegation', err instanceof Error ? err : new Error(String(err)));
      
      // Provide more helpful error messages
      if (errorMessage.includes('json-rpc') || errorMessage.includes('not supported') || errorMessage.includes('Account type')) {
        setError(
          'EIP-7702 revocation currently requires a local account (private key) or Base Account. ' +
          'Your current wallet uses JSON-RPC which does not support signing EIP-7702 authorizations through viem. ' +
          'Try using Base Account (Coinbase Wallet), or wait for wallet providers to add native EIP-7702 support. ' +
          'For more information: https://docs.cdp.coinbase.com/paymaster/need-to-knows/eip-7702-faqs'
        );
      } else {
        setError(errorMessage);
      }
      setIsRevoking(false);
    }
  };

  // Handle transaction confirmation
  useEffect(() => {
    if (txHash && !isConfirming) {
      // Transaction confirmed, refresh status
      setTimeout(() => {
        checkStatus();
        setIsDelegating(false);
        setIsRevoking(false);
        setTxHash(null);
      }, 2000);
    }
  }, [txHash, isConfirming]);

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>EIP-7702 Delegation</CardTitle>
          <CardDescription>
            Connect your wallet to delegate or revoke EIP-7702 authorization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>Please connect your wallet to continue</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!isBaseChain) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>EIP-7702 Delegation</CardTitle>
          <CardDescription>
            Delegate your EOA to EIP-7702 Proxy or revoke existing delegation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Please switch to Base network to use EIP-7702 delegation
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          EIP-7702 Delegation
        </CardTitle>
        <CardDescription>
          Delegate your EOA to EIP-7702 Proxy to enable smart account functionality at the same address
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Display */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Status:</span>
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : isDelegated ? (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Delegated
              </Badge>
            ) : (
              <Badge variant="outline">
                <XCircle className="h-3 w-3 mr-1" />
                Not Delegated
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkStatus}
            disabled={isChecking}
          >
            {isChecking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              'Refresh'
            )}
          </Button>
        </div>

        {/* Implementation Address */}
        {isDelegated && implementation && (
          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="text-sm font-medium mb-1">Implementation:</div>
            <div className="flex items-center gap-2">
              <code className="text-xs">{formatAddress(implementation)}</code>
              <a
                href={`https://basescan.org/address/${implementation}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Transaction Status */}
        {txHash && (
          <Alert>
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>
                  {isConfirming ? 'Transaction confirming...' : 'Transaction confirmed!'}
                </span>
                <a
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1"
                >
                  View on Basescan
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!isDelegated ? (
            <Button
              onClick={handleDelegate}
              disabled={isDelegating || isRevoking || isConfirming || isChecking}
              className="flex-1"
            >
              {isDelegating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Delegating...
                </>
              ) : (
                'Delegate to EIP-7702'
              )}
            </Button>
          ) : (
            <Button
              onClick={handleRevoke}
              disabled={isDelegating || isRevoking || isConfirming || isChecking}
              variant="destructive"
              className="flex-1"
            >
              {isRevoking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Revoking...
                </>
              ) : (
                'Revoke Delegation'
              )}
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Delegate:</strong> Temporarily upgrade your EOA to a smart account at the same address.
          </p>
          <p>
            <strong>Revoke:</strong> Remove the delegation and return to a regular EOA.
          </p>
          <div className="pt-2 space-y-1">
            <p>
              <strong>Note:</strong> EIP-7702 delegation requires wallet support. Try using{' '}
              <strong>Base Account</strong> (Coinbase Wallet) which may have better support. Standard browser wallets
              (MetaMask, WalletConnect) may not work until they add native EIP-7702 support.
            </p>
            <div className="pt-2 space-y-0.5">
              <p className="font-medium">Contract addresses (Base, v1.0.0):</p>
              <ul className="list-none space-y-0.5 font-mono text-[11px]">
                <li>EIP7702Proxy: <code className="break-all">{EIP7702_CONTRACTS.PROXY_TEMPLATE}</code></li>
                <li>NonceTracker: <code className="break-all">{EIP7702_CONTRACTS.NONCE_TRACKER}</code></li>
                <li>DefaultReceiver: <code className="break-all">{EIP7702_CONTRACTS.DEFAULT_RECEIVER}</code></li>
                <li>Validator: <code className="break-all">{EIP7702_CONTRACTS.VALIDATOR}</code></li>
                <li>CBSW Implementation: <code className="break-all">{EIP7702_CONTRACTS.CBSW_IMPLEMENTATION}</code></li>
              </ul>
              <a
                href="https://github.com/base/eip-7702-proxy"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 mt-1"
              >
                Source: github.com/base/eip-7702-proxy
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
