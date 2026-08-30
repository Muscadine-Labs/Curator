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
import {
  CuratorPanel,
  CuratorSectionHeader,
} from '@/components/morpho/CuratorChrome';
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
  {
    title: 'Bots',
    description: 'Watch allocator / sentinel EOA activity and open automation bot repos.',
    href: '/curator/bots',
    icon: Bot,
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
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50">
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

export default function CuratorToolsPage() {
  return (
    <AppShell
      title="Curator tools"
      description="Curator hub — in-app flows, official Morpho surfaces, and automation bots."
    >
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <section className="space-y-3">
          <CuratorSectionHeader
            title="In this app"
            description="Shortcuts into Vaults, Markets, and Safe. Primary nav is in the top bar."
          />
          <CuratorPanel>
            <div className="divide-y divide-border">
              {IN_APP_TOOLS.map((tool) => (
                <HubLinkRow key={tool.href} tool={tool} />
              ))}
            </div>
          </CuratorPanel>
        </section>

        <section className="space-y-3">
          <CuratorSectionHeader
            title="External Morpho links"
            description="Official Morpho surfaces. Curator vault writes stay in this app."
          />
          <CuratorPanel>
            <div className="divide-y divide-border">
              {EXTERNAL_TOOLS.map((tool) => (
                <HubLinkRow key={tool.href} tool={tool} />
              ))}
            </div>
          </CuratorPanel>
        </section>

        <section className="space-y-3">
          <CuratorSectionHeader
            title="Automation bots"
            description="Muscadine vault bots and Morpho bots monorepo. Live activity watch is under Curator → Bots."
          />
          <CuratorPanel>
            <div className="divide-y divide-border">
              {MORPHO_AUTOMATION_BOTS.map((bot) => (
                <div
                  key={bot.href}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <a
                    href={bot.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-start gap-3"
                  >
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50">
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
                  {bot.telegramHref ? (
                    <a
                      href={bot.telegramHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 shrink-0 text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Telegram
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </CuratorPanel>
        </section>
      </div>
    </AppShell>
  );
}
