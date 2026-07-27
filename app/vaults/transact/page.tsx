'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { VaultTransactBox } from '@/components/morpho/VaultTransactBox';
import { Skeleton } from '@/components/ui/skeleton';

function VaultTransactContent() {
  const searchParams = useSearchParams();
  const initialVault = searchParams.get('vault') ?? undefined;
  return <VaultTransactBox initialVaultAddress={initialVault} />;
}

export default function VaultsTransactPage() {
  return (
    <AppShell
      title="Vault Transact"
      description="Deposit or withdraw from Morpho Vault V2 — approve, wrap/unwrap ETH via Bundler3."
      backHref="/vaults"
      backLabel="Vaults"
    >
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-xl">
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        }
      >
        <VaultTransactContent />
      </Suspense>
    </AppShell>
  );
}
