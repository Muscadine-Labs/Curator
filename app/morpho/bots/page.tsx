'use client';

import { AppShell } from '@/components/layout/AppShell';
import { BotWatchPanel } from '@/components/bots/BotWatchPanel';

export default function BotsPage() {
  return (
    <AppShell
      title="Bots"
      description="Allocator and sentinel activity across all role holders. Automation bot repos live under Morpho Tools."
    >
      <div className="mx-auto w-full max-w-5xl">
        <BotWatchPanel />
      </div>
    </AppShell>
  );
}
