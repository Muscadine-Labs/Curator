'use client';

import { AppShell } from '@/components/layout/AppShell';
import { DelegationControl } from '@/components/eip7702/DelegationControl';

export default function EIP7702Page() {
  return (
    <AppShell
      title="EIP-7702"
      description="Personal front end for EIP-7702 info—no need to rely on third parties or Basescan."
    >
      <div className="max-w-2xl space-y-6">
        <p className="text-sm text-muted-foreground">Work in progress</p>
        {/* Delegation Control */}
        <DelegationControl />
      </div>
    </AppShell>
  );
}
