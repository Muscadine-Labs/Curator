'use client';

import Link from 'next/link';
import {
  ArrowDownUp,
  BookOpen,
  Bot,
  Droplets,
  ExternalLink,
  LayoutGrid,
  Plus,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent } from '@/components/ui/card';
import {
  MORPHO_APP_VAULTS_URL,
  MORPHO_AUTOMATION_BOTS,
  MORPHO_CURATOR_V2_VAULTS_URL,
  MORPHO_DOCS_GET_STARTED_URL,
  MORPHO_LIQUIDATION_APP_URL,
  MORPHO_ORACLE_PORTAL_URL,
} from '@/lib/constants';

type HubLink = {
  title: string;
  description: string;
  href: string;
  icon: typeof Shield;
  external?: boolean;
};

const IN_APP_TOOLS: readonly HubLink[] = [
  {
    title: 'Vault Transact',
    description: 'Deposit or withdraw from managed Vault V2 (Bundler3 wrap/unwrap for WETH).',
    href: '/vaults/transact',
    icon: ArrowDownUp,
  },
  {
    title: 'Market Positions',
    description: 'Repay debt, withdraw collateral, or add/withdraw Blue market supply.',
    href: '/markets/positions',
    icon: LayoutGrid,
  },
  {
    title: 'Create Morpho Blue market',
    description: 'createMarket plus one-time dead deposit and optional rate seed.',
    href: '/markets/create',
    icon: Plus,
  },
  {
    title: 'Multisig Safe',
    description: 'Queue and execute Curator / Allocator / Sentinel Safe transactions.',
    href: '/safe',
    icon: Users,
  },
];

const EXTERNAL_TOOLS: readonly HubLink[] = [
  {
    title: 'Morpho App — Vaults',
    description: 'Browse and deposit into Morpho vaults on app.morpho.org.',
    href: MORPHO_APP_VAULTS_URL,
    icon: LayoutGrid,
    external: true,
  },
  {
    title: 'Morpho Curator V2',
    description: 'Official Morpho curator UI for Vault V2 (caps, roles, emergency).',
    href: MORPHO_CURATOR_V2_VAULTS_URL,
    icon: Shield,
    external: true,
  },
  {
    title: 'Liquidation App',
    description: 'Morpho liquidation interface for Blue markets.',
    href: MORPHO_LIQUIDATION_APP_URL,
    icon: Droplets,
    external: true,
  },
  {
    title: 'Oracle Portal',
    description: 'Build, decode, and validate MorphoChainlink oracles before deploy.',
    href: MORPHO_ORACLE_PORTAL_URL,
    icon: Sparkles,
    external: true,
  },
  {
    title: 'Morpho Docs',
    description: 'Get started with Morpho — Earn, Borrow, curate, API, and SDK.',
    href: MORPHO_DOCS_GET_STARTED_URL,
    icon: BookOpen,
    external: true,
  },
];

function HubLinkRow({ tool }: { tool: HubLink }) {
  const Icon = tool.icon;
  const className =
    'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40';
  const inner = (
    <>
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/50">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {tool.title}
          {tool.external ? (
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {tool.description}
        </span>
      </span>
    </>
  );

  if (tool.external) {
    return (
      <a href={tool.href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={tool.href} className={className}>
      {inner}
    </Link>
  );
}

export default function MorphoCuratorPage() {
  return (
    <AppShell
      title="Morpho Tools"
      description="Curator hub — in-app flows, official Morpho surfaces, and automation bots."
    >
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">In this app</h2>
            <p className="text-xs text-muted-foreground">
              Shortcuts into Vaults, Markets, and Safe. Primary nav is in the top bar.
            </p>
          </div>
          <Card className="border-border/70">
            <CardContent className="divide-y divide-border/60 p-0">
              {IN_APP_TOOLS.map((tool) => (
                <HubLinkRow key={tool.href} tool={tool} />
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">External Morpho links</h2>
            <p className="text-xs text-muted-foreground">
              Official Morpho surfaces. Curator vault writes stay in this app.
            </p>
          </div>
          <Card className="border-border/70">
            <CardContent className="divide-y divide-border/60 p-0">
              {EXTERNAL_TOOLS.map((tool) => (
                <HubLinkRow key={tool.href} tool={tool} />
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Automation bots</h2>
            <p className="text-xs text-muted-foreground">
              Morpho curator bots monorepo and Muscadine Vault V2 reallocation fork.
            </p>
          </div>
          <Card className="border-border/70">
            <CardContent className="divide-y divide-border/60 p-0">
              {MORPHO_AUTOMATION_BOTS.map((bot) => (
                <a
                  key={bot.href}
                  href={bot.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/50">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      {bot.title}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {bot.description}
                    </span>
                  </span>
                </a>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
