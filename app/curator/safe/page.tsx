'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Shield, Wallet, Users, Lock, Coins } from 'lucide-react';

export default function MultisigSafePage() {
  return (
    <AppShell
      title="Multisig Safe"
      description="Access Safe multisig wallets for vault roles and treasury management."
    >
      <div className="space-y-6">
        {/* Muscadine Space */}
        <Card className="border-2 border-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Muscadine Space
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              size="lg"
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <a
                href="https://app.safe.global/spaces?spaceId=3668"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                Open Muscadine Space
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Vault Roles Safes */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Vault Roles Safes</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Owner Wallet */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4" />
                  Owner Wallet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="font-mono text-xs text-slate-500 break-all">
                  0x4E5D3ef790C75682ac4f6d4C1dDCc08b36fC100A
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="w-full"
                >
                  <a
                    href="https://app.safe.global/home?safe=base:0x4E5D3ef790C75682ac4f6d4C1dDCc08b36fC100A"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    Open Safe
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Curator Wallet */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4" />
                  Curator Wallet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="font-mono text-xs text-slate-500 break-all">
                  0xb6d1d784e9Bc3570546e231caCB52B4E0f1ED8b1
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="w-full"
                >
                  <a
                    href="https://app.safe.global/home?safe=base:0xb6d1d784e9Bc3570546e231caCB52B4E0f1ED8b1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    Open Safe
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Guardian / Sentinel Wallet */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="h-4 w-4" />
                  Guardian / Sentinel Wallet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="font-mono text-xs text-slate-500 break-all">
                  0x64e804eEF4F5a53272A8623b563ad2724E98A0a9
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="w-full"
                >
                  <a
                    href="https://app.safe.global/home?safe=base:0x64e804eEF4F5a53272A8623b563ad2724E98A0a9"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    Open Safe
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Treasury Wallet */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Coins className="h-4 w-4" />
                  Treasury Wallet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="font-mono text-xs text-slate-500 break-all">
                  0x057fd8B961Eb664baA647a5C7A6e9728fabA266A
                </div>
                <div className="flex gap-2">
                  <Button
                    asChild
                    variant="outline"
                    className="flex-1"
                  >
                    <a
                      href="https://app.safe.global/home?safe=base:0x057fd8B961Eb664baA647a5C7A6e9728fabA266A"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2"
                    >
                      Open Safe
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="flex-1"
                  >
                    <a
                      href="https://debank.com/profile/0x057fd8b961eb664baa647a5c7a6e9728faba266a"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2"
                    >
                      Debank
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







