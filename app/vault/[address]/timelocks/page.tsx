'use client';

import { useVaultPage } from '@/components/morpho/VaultPageShell';
import { VaultV2Timelocks } from '@/components/morpho/VaultV2Timelocks';

export default function VaultTimelocksPage() {
  const { vault, governance } = useVaultPage();

  return <VaultV2Timelocks vaultAddress={vault.address} preloadedData={governance} />;
}
