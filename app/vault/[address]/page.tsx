'use client';

import { useVaultPage } from '@/components/morpho/VaultPageShell';
import { VaultOverviewPanel } from '@/components/morpho/VaultOverviewPanel';

export default function VaultOverviewPage() {
  const {
    vault,
    morphoUiUrl,
    vaultName,
    vaultSymbol,
    vaultAsset,
    governance,
    risk,
  } = useVaultPage();

  return (
    <VaultOverviewPanel
      vault={vault}
      morphoUiUrl={morphoUiUrl}
      vaultName={vaultName}
      vaultSymbol={vaultSymbol}
      vaultAsset={vaultAsset}
      governance={governance}
      risk={risk}
    />
  );
}
