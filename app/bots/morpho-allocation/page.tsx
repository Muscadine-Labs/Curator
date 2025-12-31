'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export default function MorphoAllocationBotPage() {
  return (
    <AppShell
      title="Morpho-blue Allocation Bot"
      description="Monitor and manage the Morpho-blue allocation bot."
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Morpho Blue Reallocation Bot</CardTitle>
            <CardDescription>
              A simple, fast, and easily deployable reallocation bot for the Morpho Blue protocol.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                This bot automatically rebalances assets within MetaMorpho vaults to maintain capital efficiency
                by equalizing utilization rates across markets.
              </p>
              <Button
                asChild
                variant="default"
                className="w-full sm:w-auto"
              >
                <a
                  href="https://github.com/morpho-org/morpho-blue-reallocation-bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  View on GitHub
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

