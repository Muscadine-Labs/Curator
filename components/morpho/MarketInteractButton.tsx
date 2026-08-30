'use client';

import Link from 'next/link';
import { ArrowDownUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  curatorMarketPositionsHref,
  morphoMidnightMarketHref,
} from '@/lib/morpho/morpho-app-links';

type MarketInteractButtonProps = {
  product: 'blue' | 'midnight';
  marketId: string;
  chainId: number;
  className?: string;
};

export function MarketInteractButton({
  product,
  marketId,
  chainId,
  className,
}: MarketInteractButtonProps) {
  if (product === 'blue') {
    const href = curatorMarketPositionsHref(marketId, chainId);
    if (!href) return null;
    return (
      <Button size="sm" className={className} asChild>
        <Link href={href}>
          <ArrowDownUp className="mr-1.5 h-4 w-4" />
          Interact
        </Link>
      </Button>
    );
  }

  const href = morphoMidnightMarketHref(marketId, chainId);
  if (!href) return null;
  return (
    <Button size="sm" variant="outline" className={className} asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        Trade on Morpho
        <ExternalLink className="ml-1.5 h-4 w-4" />
      </a>
    </Button>
  );
}
