'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { usePendingToken, useRevenueSplit, useTotalReleased, useReleased } from '@/lib/hooks/useRevenueSplit';
import { formatCompactUSD } from '@/lib/format/number';
import { vaults } from '@/lib/config/vaults';
import { AddressBadge } from './AddressBadge';
// OnchainKit integrates with wagmi, so we use wagmi hooks for contract interactions
import { useAccount, useWriteContract } from 'wagmi';
import { Address } from 'viem';
import { base } from 'viem/chains';
import { ERC20_FEE_SPLITTER_ABI } from '@/lib/onchain/client';

export function PendingTokenPanel() {
  const [selectedVault, setSelectedVault] = useState<string>('');
  const [selectedPayee, setSelectedPayee] = useState<string>('');
  const [txError, setTxError] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  
  const { data: revenueSplit, isLoading: splitLoading, error: splitError } = useRevenueSplit();
  const { data: pendingData, isLoading: pendingLoading } = usePendingToken(
    selectedVault as `0x${string}` || null,
    selectedPayee as `0x${string}` || null
  );
  const { data: totalReleased, isLoading: totalReleasedLoading } = useTotalReleased(
    selectedVault as `0x${string}` || null
  );
  const { data: released, isLoading: releasedLoading } = useReleased(
    selectedVault as `0x${string}` || null,
    selectedPayee as `0x${string}` || null
  );
  const { address: connectedAddress } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

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
          ) : revenueSplit && (revenueSplit.payee1 || revenueSplit.payee2) ? (
            <div>
              <label className="text-sm font-medium mb-2 block">Select Payee</label>
              <select
                value={selectedPayee}
                onChange={(e) => setSelectedPayee(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="">Select a payee...</option>
                {revenueSplit.payee1 && (
                  <option value={revenueSplit.payee1}>
                    Payee 1 - {revenueSplit.payee1.slice(0, 10)}...
                  </option>
                )}
                {revenueSplit.payee2 && (
                  <option value={revenueSplit.payee2}>
                    Payee 2 - {revenueSplit.payee2.slice(0, 10)}...
                  </option>
                )}
              </select>
            </div>
          ) : splitError ? (
            <div className="text-sm text-red-600 space-y-1">
              <p>Error loading fee splitter: {splitError instanceof Error ? splitError.message : 'Unknown error'}</p>
              <p className="text-xs text-muted-foreground">Contract: 0x194DeC45D34040488f355823e1F94C0434304188</p>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Loading fee splitter data...</p>
              <p className="text-xs">Contract: 0x194DeC45D34040488f355823e1F94C0434304188</p>
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
              
              <div className="pt-3 border-t space-y-3">
                <div>
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
                <div>
                  <label className="text-sm font-medium mb-2 block">Released Amount</label>
                  {releasedLoading ? (
                    <Skeleton className="h-8 w-32" />
                  ) : released ? (
                    <div className="text-2xl font-bold">
                      {formatCompactUSD(Number(released))}
                    </div>
                  ) : (
                    <div className="text-lg text-muted-foreground">$0.00</div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Total Released (Token)</label>
                  {totalReleasedLoading ? (
                    <Skeleton className="h-8 w-32" />
                  ) : totalReleased ? (
                    <div className="text-xl font-semibold">
                      {formatCompactUSD(Number(totalReleased))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">$0.00</div>
                  )}
                </div>
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
                    const hash = await writeContractAsync({
                      address: splitterAddress,
                      abi: ERC20_FEE_SPLITTER_ABI,
                      functionName: 'claim',
                      args: [selectedVault as Address, selectedPayee as Address],
                      chainId: base.id, // Explicitly use Base chain
                    });
                    setTxHash(hash);
                  } catch (e: unknown) {
                    type WagmiTxError = { shortMessage?: string; message?: string };
                    const err = (typeof e === 'object' && e !== null) ? (e as Partial<WagmiTxError>) : {};
                    const msg = typeof err.message === 'string' ? err.message : 'Transaction failed';
                    const shortMsg = typeof err.shortMessage === 'string' ? err.shortMessage : '';
                    setTxError(shortMsg || msg);
                  }
                }}
                disabled={!connectedAddress || !selectedVault || !selectedPayee || isPending}
                className="flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4" />
                {isPending ? 'Claiming...' : 'Claim'}
              </Button>
            </div>
          )}
          {selectedVault && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  setTxError('');
                  setTxHash('');
                  if (!connectedAddress) {
                    setTxError('Please connect your wallet first');
                    return;
                  }
                  if (!selectedVault) {
                    setTxError('Please select a vault (token) first');
                    return;
                  }
                  try {
                    const splitterAddress = '0x194DeC45D34040488f355823e1F94C0434304188' as Address;
                    console.log('Calling claimAll:', {
                      address: splitterAddress,
                      functionName: 'claimAll',
                      args: [selectedVault],
                    });
                    const hash = await writeContractAsync({
                      address: splitterAddress,
                      abi: ERC20_FEE_SPLITTER_ABI,
                      functionName: 'claimAll',
                      args: [selectedVault as Address],
                      chainId: base.id, // Explicitly use Base chain
                    });
                    console.log('Transaction hash:', hash);
                    setTxHash(hash);
                  } catch (e: unknown) {
                    console.error('claimAll error:', e);
                    type WagmiTxError = { shortMessage?: string; message?: string; cause?: unknown };
                    const err = (typeof e === 'object' && e !== null) ? (e as Partial<WagmiTxError>) : {};
                    const msg = typeof err.message === 'string' ? err.message : 'Transaction failed';
                    const shortMsg = typeof err.shortMessage === 'string' ? err.shortMessage : '';
                    const errorMsg = shortMsg || msg || 'Unknown error occurred';
                    setTxError(errorMsg);
                  }
                }}
                disabled={!connectedAddress || !selectedVault || isPending}
                className="flex items-center gap-2"
              >
                {isPending ? 'Claiming All...' : 'Claim All'}
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

