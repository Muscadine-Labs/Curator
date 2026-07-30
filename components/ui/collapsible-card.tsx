'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CollapsibleCardProps {
  title: ReactNode;
  /** Optional controls shown on the right of the header (only when open). */
  headerRight?: ReactNode;
  /** Badge / meta next to the title (always visible). */
  titleMeta?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  children: ReactNode;
  /** Called when open state changes — useful to gate data fetching. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Card whose body is hidden until the header (or chevron) is pressed.
 * Defaults to collapsed to save space on dense pages.
 */
export function CollapsibleCard({
  title,
  headerRight,
  titleMeta,
  defaultOpen = false,
  className,
  headerClassName,
  contentClassName,
  children,
  onOpenChange,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      onOpenChange?.(next);
      return next;
    });
  };

  return (
    <Card className={cn(!open && 'gap-0 py-4', className)}>
      <CardHeader className={cn('pb-0', open && 'pb-2', headerClassName)}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            {open ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm">
              {title}
              {titleMeta}
            </CardTitle>
          </button>
          {open && headerRight ? (
            <div className="flex flex-wrap items-center gap-2 pl-6 sm:pl-0">
              {headerRight}
            </div>
          ) : null}
        </div>
      </CardHeader>
      {open ? (
        <CardContent className={cn('pt-0', contentClassName)}>{children}</CardContent>
      ) : null}
    </Card>
  );
}
