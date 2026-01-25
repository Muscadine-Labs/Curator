'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export default function MorphoCuratorPage() {
  return (
    <AppShell
      title="Morpho"
      description="Access Morpho interfaces and automated bots for vault management."
    >
      <div className="space-y-10">
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
            {/* Vault V1 - Left */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-center">Vault V1</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col items-center justify-center">
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  <a
                    href="https://curator-v1.morpho.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    Open Vault V1
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Directory - Middle */}
            <Card className="flex flex-col border-2 border-blue-600">
              <CardHeader>
                <CardTitle className="text-center">Directory</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col items-center justify-center">
                <Button
                  asChild
                  size="lg"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <a
                    href="https://curator.morpho.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    Open Directory
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Vault v2 - Right */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-center">Vault v2</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col items-center justify-center">
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  <a
                    href="https://curator.morpho.org/vaults"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    Open Vault v2
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Morpho Bots - Bottom */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Morpho Automated Bots
          </h2>
          <div className="grid gap-6 md:grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle>Morpho Liquidation Bot</CardTitle>
                <CardDescription>
                  Easily configurable liquidation bot for Morpho Blue.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    This bot monitors and executes liquidations on Morpho Blue markets, helping
                    maintain protocol health and providing liquidation opportunities.
                  </p>
                  <Button asChild variant="default" className="w-full sm:w-auto">
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
                  A simple, fast, and easily deployable reallocation bot for the Morpho Blue
                  protocol.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    This bot automatically rebalances assets within MetaMorpho vaults to maintain
                    capital efficiency by equalizing utilization rates across markets.
                  </p>
                  <Button asChild variant="default" className="w-full sm:w-auto">
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
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    This bot handles reallocation for Morpho Vault V2, managing asset distribution
                    across markets to optimize capital efficiency and maintain target allocations.
                  </p>
                  <Button asChild variant="default" className="w-full sm:w-auto">
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
        </div>
      </div>
    </AppShell>
  );
}

