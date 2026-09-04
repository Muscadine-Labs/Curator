'use client';

import { Badge } from '@/components/ui/badge';
import { resolveDepositorLabel } from '@/lib/format/address-label';
import { formatAddress } from '@/lib/format/number';
import { cn } from '@/lib/utils';

type DepositorAddressProps = {
  address: string;
  href?: string;
  startChars?: number;
  endChars?: number;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

/** Truncated address with a Treasury / vault / Safe badge when the holder is known. */
export function DepositorAddress({
  address,
  href,
  startChars = 6,
  endChars = 4,
  className,
  onClick,
}: DepositorAddressProps) {
  const known = resolveDepositorLabel(address);
  const truncated = formatAddress(address, startChars, endChars);
  const addrClass = cn(
    'font-mono text-xs',
    href && 'text-blue-600 hover:underline dark:text-blue-400'
  );

  const addrEl = href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={addrClass}
      onClick={onClick}
    >
      {truncated}
    </a>
  ) : (
    <span className={addrClass}>{truncated}</span>
  );

  return (
    <span className={cn('inline-flex max-w-full flex-wrap items-center gap-1.5', className)}>
      {known ? (
        <Badge variant="outline" className="text-[10px] font-medium">
          {known.label}
        </Badge>
      ) : null}
      {addrEl}
    </span>
  );
}
