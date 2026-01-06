'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export default function MorphoAutomatedBotsPage() {
  return (
    <AppShell
      title="Morpho Automated Bots"
      description="Monitor and manage Morpho automated bots for liquidation and allocation."
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Morpho Liquidation Bot</CardTitle>
            <CardDescription>
              Easily configurable liquidation bot for Morpho Blue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                This bot monitors and executes liquidations on Morpho Blue markets, helping maintain
                protocol health and providing liquidation opportunities.
              </p>
              <Button
                asChild
                variant="default"
                className="w-full sm:w-auto"
              >
                <a
                  href="https://github.com/morpho-org/morpho-blue-liquidation-bot"
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

        <Card>
          <CardHeader>
            <CardTitle>Morpho Blue Reallocation Bot (V1)</CardTitle>
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

        <Card>
          <CardHeader>
            <CardTitle>Morpho Vault V2 Reallocation Bot</CardTitle>
            <CardDescription>
              Reallocation bot for Morpho Vault V2 protocol.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                This bot handles reallocation for Morpho Vault V2, managing asset distribution across markets
                to optimize capital efficiency and maintain target allocations.
              </p>
              <Button
                asChild
                variant="default"
                className="w-full sm:w-auto"
              >
                <a
                  href="https://github.com/morpho-org/vault-v2-reallocation-bot"
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

