'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

const MUSCADINE_DOMAINS = [
  { name: 'Muscadine', url: 'https://muscadine.io', description: 'Website' },
  { name: 'Analytics', url: 'https://analytics.muscadine.io', description: 'Analytics' },
  { name: 'App', url: 'https://app.muscadine.io', description: 'App' },
  { name: 'Curator', url: 'https://curator.muscadine.io', description: 'Curator' },
  { name: 'Docs', url: 'https://docs.muscadine.io', description: 'Documentation' },
] as const;

const DEVELOPMENT = [
  { name: 'GitHub', url: 'https://github.com/Muscadine-Labs', description: 'Muscadine-Labs' },
  { name: 'Vercel', url: 'https://vercel.com/muscadine-labs', description: 'muscadine-labs' },
  { name: 'Google Drive', url: 'https://drive.google.com/drive/u/1/folders/15YowG9xg376DzOftvXj2vQvTeXX9cZJc', description: 'Drive folder', displayText: 'drive.google.com' },
] as const;

const BUSINESS_SERVICES = [
  { name: 'Georgia Secretary of State', url: 'https://ecorp.sos.ga.gov/', description: 'ecorp.sos.ga.gov' },
  { name: 'NameSilo', url: 'https://www.namesilo.com/', description: 'Domain registrar' },
] as const;

function LinkCard({
  name,
  url,
  description,
  displayText,
}: {
  name: string;
  url: string;
  description: string;
  displayText?: string;
}) {
  const buttonLabel = displayText ?? url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-center text-base">{name}</CardTitle>
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center">
        <Button asChild variant="outline" size="lg" className="w-full">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2"
          >
            {buttonLabel}
            <ExternalLink className="h-4 w-4 shrink-0" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function MuscadinePagesPage() {
  return (
    <AppShell
      title="Muscadine Pages"
      description="Quick links to Muscadine domains, development, and business services."
    >
      <div className="space-y-8">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Muscadine Domains
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MUSCADINE_DOMAINS.map((item) => (
              <LinkCard key={item.url} {...item} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            GitHub, Vercel & Google Drive
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEVELOPMENT.map((item) => (
              <LinkCard key={item.url} {...item} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Business Services
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {BUSINESS_SERVICES.map((item) => (
              <LinkCard key={item.url} {...item} />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
