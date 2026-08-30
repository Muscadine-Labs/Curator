'use client';

import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { VaultsCatalog } from '@/components/morpho/VaultsCatalog';

export default function VaultsCatalogPage() {
  return (
    <AppShell
      title="Vaults"
      description="Managed Morpho Vault V2 catalog — open a vault for curator ops, or Transact to deposit/withdraw."
      actions={
        <Link
          href="/vaults/transact"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted/50"
        >
          Transact
        </Link>
      }
    >
      <div className="mx-auto w-full max-w-6xl">
        <VaultsCatalog />
      </div>
    </AppShell>
  );
}
