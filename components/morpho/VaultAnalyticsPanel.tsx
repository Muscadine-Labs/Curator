'use client';

import type { VaultDetail } from '@/lib/hooks/useProtocolStats';
import { VaultRiskV2 } from '@/components/morpho/VaultRiskV2';

interface VaultAnalyticsPanelProps {
  vault: VaultDetail;
  risk?: import('@/app/api/vaults/[id]/risk/route').V2VaultRiskResponse | null;
}

export function VaultAnalyticsPanel({ vault, risk }: VaultAnalyticsPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Risk Analytics</h2>
        <p className="text-xs text-muted-foreground">
          Market risk grades for this vault&apos;s allocations.
        </p>
      </div>

      <VaultRiskV2
        vaultAddress={vault.address}
        chainId={vault.chainId}
        preloadedData={risk}
      />
    </div>
  );
}
