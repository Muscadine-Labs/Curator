'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { usePendingToken, useRevenueSplit } from '@/lib/hooks/useRevenueSplit';
import { formatCompactUSD } from '@/lib/format/number';
import { vaults } from '@/lib/config/vaults';
import { AddressBadge } from './AddressBadge';
import { useAccount, useWriteContract } from 'wagmi';
import { Address } from 'viem';
import { ERC20_FEE_SPLITTER_ABI } from '@/lib/onchain/client';

export function PendingTokenPanel() {
  const [selectedVault, setSelectedVault] = useState<string>('');
  const [selectedPayee, setSelectedPayee] = useState<string>('');
  const [txError, setTxError] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  
  const { data: revenueSplit, isLoading: splitLoading } = useRevenueSplit();
  const { data: pendingData, isLoading: pendingLoading } = usePendingToken(
    selectedVault as `0x${string}` || null,
    selectedPayee as `0x${string}` || null
  );
  const { address: connectedAddress } = useAccount();
  const { writeContract, isPending } = useWriteContract();

  // Get payee addresses from revenue split
  const payees = revenueSplit ? [
    { label: 'Payee 1', address: revenueSplit.payee1 },
    { label: 'Payee 2', address: revenueSplit.payee2 },
  ].filter(p => p.address) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check Pending Fees</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Vault Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Select Vault (Token)</label>
            <select
              value={selectedVault}
              onChange={(e) => setSelectedVault(e.target.value)}
              className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              <option value="">Select a vault...</option>
              {vaults.map((vault) => (
                <option key={vault.id} value={vault.address}>
                  {vault.name} ({vault.asset})
                </option>
              ))}
            </select>
          </div>

          {/* Payee Selection */}
          {splitLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : payees.length > 0 ? (
            <div>
              <label className="text-sm font-medium mb-2 block">Select Payee</label>
              <select
                value={selectedPayee}
                onChange={(e) => setSelectedPayee(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="">Select a payee...</option>
                {payees.map((payee, index) => (
                  <option key={index} value={payee.address || ''}>
                    {payee.label} - {payee.address?.slice(0, 10)}...
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Fee splitter contract not configured
            </div>
          )}

          {/* Display Selected Info */}
          {selectedVault && selectedPayee && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Vault Address</label>
                <AddressBadge address={selectedVault} scanUrl={`https://basescan.org/address/${selectedVault}`} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Payee Address</label>
                <AddressBadge address={selectedPayee} scanUrl={`https://basescan.org/address/${selectedPayee}`} />
              </div>
              
              <div className="pt-3 border-t">
                <label className="text-sm font-medium mb-2 block">Pending Amount</label>
                {pendingLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : pendingData?.payee1Pending || pendingData?.payee2Pending ? (
                  <div className="text-2xl font-bold">
                    {formatCompactUSD(
                      selectedPayee === revenueSplit?.payee1 
                        ? Number(pendingData.payee1Pending || 0)
                        : Number(pendingData.payee2Pending || 0)
                    )}
                  </div>
                ) : (
                  <div className="text-lg text-muted-foreground">$0.00</div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {selectedVault && selectedPayee && (
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  setTxError('');
                  setTxHash('');
                  try {
                    const splitterAddress = (process.env.NEXT_PUBLIC_FEE_SPLITTER as Address) ||
                      ('0x194DeC45D34040488f355823e1F94C0434304188' as Address);
                const hash = await writeContract({
                      address: splitterAddress,
                      abi: ERC20_FEE_SPLITTER_ABI,
                      functionName: 'claim',
                      args: [selectedVault as Address],
                    });
                    // wagmi v2 returns hash directly
                setTxHash(typeof hash === 'string' ? hash : '');
              } catch (e: unknown) {
                type WagmiTxError = { shortMessage?: string; message?: string };
                const err = (typeof e === 'object' && e !== null) ? (e as Partial<WagmiTxError>) : {};
                const msg = typeof err.message === 'string' ? err.message : 'Transaction failed';
                const shortMsg = typeof err.shortMessage === 'string' ? err.shortMessage : '';
                setTxError(shortMsg || msg);
                  }
                }}
                disabled={!connectedAddress || !selectedVault || isPending}
                className="flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4" />
                {isPending ? 'Claiming...' : 'Claim'}
              </Button>
            </div>
          )}

          {/* Instructions */}
          <div className="text-sm text-muted-foreground">
            <p>Select a vault (token) and a payee to check pending fees from the Fee Splitter contract.</p>
            {txHash && (
              <p className="mt-2">
                Tx sent: <a className="underline" target="_blank" rel="noreferrer" href={`https://basescan.org/tx/${txHash}`}>{txHash.slice(0, 10)}...</a>
              </p>
            )}
            {txError && (
              <p className="mt-2 text-red-600">{txError}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

