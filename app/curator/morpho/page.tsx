'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export default function MorphoCuratorPage() {
  return (
    <AppShell
      title="Morpho Curator"
      description="Access Morpho Curator interfaces for vault management."
    >
      <div className="flex min-h-[60vh] items-center justify-center">
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
    </AppShell>
  );
}

