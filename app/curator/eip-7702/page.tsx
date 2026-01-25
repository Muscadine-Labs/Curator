'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

const EIP_7702_FAQS_URL = 'https://docs.cdp.coinbase.com/paymaster/need-to-knows/eip-7702-faqs#will-base-appchains-support-7702';

export default function EIP7702Page() {
  return (
    <AppShell
      title="EIP-7702"
      description="Personal front end for EIP-7702 info—no need to rely on third parties or Basescan."
    >
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>EIP-7702 FAQs</CardTitle>
            <CardDescription>
              Personal front end use so I don&apos;t have to rely on third parties, or trying it on Basescan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="default" className="w-full sm:w-auto">
              <a
                href={EIP_7702_FAQS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                Will Base app chains support 7702? — CDP docs
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
