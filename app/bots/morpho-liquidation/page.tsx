'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export default function MorphoLiquidationBotPage() {
  return (
    <AppShell
      title="Morpho-blue Liquidation Bot"
      description="Monitor and manage the Morpho-blue liquidation bot."
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Morpho Blue Liquidation Bot</CardTitle>
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
      </div>
    </AppShell>
  );
}







