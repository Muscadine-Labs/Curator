'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatLtv } from '@/lib/format/number';
import type { AllocationFilterState } from '@/lib/allocation/allocation-filters';

export function formatLltvPill(lltv: string | number | null | undefined): string | null {
  const formatted = formatLtv(lltv);
  if (formatted === '—') return null;
  const parsed = parseFloat(formatted);
  if (!Number.isFinite(parsed)) return null;
  return `${parsed.toFixed(2)}%`;
}

export function AllocationPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
      {children}
    </span>
  );
}

export function formatMarketPairLabel(
  collateral: string | null | undefined,
  loan: string | null | undefined
): string {
  if (collateral && loan) return `${collateral} / ${loan}`;
  return collateral || loan || 'Market';
}

interface AllocationListShellProps {
  children: ReactNode;
  className?: string;
}

export function AllocationListShell({ children, className }: AllocationListShellProps) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border bg-card', className)}>
      <div className="min-w-[76rem]">{children}</div>
    </div>
  );
}

export function AllocationListSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

/** Morpho Curator–style dynamic column grid for V2 allocations. */
const CURATOR_OPTIONAL_COLUMNS: {
  filterKey: keyof AllocationFilterState['columns'];
  label: string;
  width: string;
}[] = [
  { filterKey: 'utilization', label: 'Util.', width: '5rem' },
  { filterKey: 'liquidity', label: 'Liquidity', width: '12rem' },
  { filterKey: 'effectiveCap', label: 'Eff. Abs. Cap', width: '9rem' },
  { filterKey: 'supplyApy', label: 'Rate', width: '5rem' },
  { filterKey: 'borrowApy', label: 'Borrow', width: '5rem' },
  { filterKey: 'allocated', label: 'Allocated', width: '8rem' },
  { filterKey: 'percentCap', label: '% Cap', width: '6rem' },
];

export function getCuratorVisibleColumns(columns: AllocationFilterState['columns']) {
  return CURATOR_OPTIONAL_COLUMNS.filter((c) => columns[c.filterKey]);
}

export function buildCuratorGridTemplate(
  columns: AllocationFilterState['columns'],
  editing: boolean
): string {
  const optional = getCuratorVisibleColumns(columns)
    .map((c) => c.width)
    .join(' ');
  const base = `minmax(12rem, 1.6fr)${optional ? ` ${optional}` : ''} 8.5rem 6.5rem`;
  return editing ? `${base} minmax(26rem, 1.5fr)` : base;
}

export function CuratorAllocationListHeader({
  editing = false,
  columns = DEFAULT_CURATOR_COLUMNS,
}: {
  editing?: boolean;
  columns?: AllocationFilterState['columns'];
}) {
  const visible = getCuratorVisibleColumns(columns);
  return (
    <div
      className="grid items-center gap-x-5 border-b px-5 py-3.5 text-xs font-medium text-muted-foreground"
      style={{ gridTemplateColumns: buildCuratorGridTemplate(columns, editing) }}
    >
      <span className="text-sm font-medium text-foreground">Allocation</span>
      {visible.map((col) => (
        <span key={col.filterKey} className="text-right">
          {col.label}
        </span>
      ))}
      <span className="text-right">Allocation</span>
      <span className="text-right">% Alloc.</span>
      {editing && <span className="text-right">Target</span>}
    </div>
  );
}

const DEFAULT_CURATOR_COLUMNS: AllocationFilterState['columns'] = {
  utilization: true,
  liquidity: true,
  borrowApy: false,
  supplyApy: true,
  allocated: false,
  effectiveCap: true,
  percentCap: false,
};

export function AllocationPctIndicator({ pct }: { pct: number }) {
  const active = pct > 0;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span
        className={cn(
          'h-3.5 w-3.5 shrink-0 rounded-full border-2',
          active ? 'border-primary bg-primary' : 'border-muted-foreground/35 bg-transparent'
        )}
        aria-hidden
      />
      <span className="text-sm tabular-nums text-foreground">{pct.toFixed(2)}%</span>
    </span>
  );
}

interface CuratorAllocationListRowProps {
  name: ReactNode;
  tags?: ReactNode;
  allocationAmount: ReactNode;
  optionalCells: ReactNode[];
  percentAllocated: ReactNode;
  targetCell?: ReactNode;
  className?: string;
  editing?: boolean;
  columns?: AllocationFilterState['columns'];
}

export function CuratorAllocationListRow({
  name,
  tags,
  allocationAmount,
  optionalCells,
  percentAllocated,
  targetCell,
  className,
  editing = false,
  columns = DEFAULT_CURATOR_COLUMNS,
}: CuratorAllocationListRowProps) {
  const visible = getCuratorVisibleColumns(columns);

  return (
    <div
      className={cn(
        'grid items-center gap-x-5 border-b border-border/60 px-5 py-4 last:border-b-0',
        className
      )}
      style={{ gridTemplateColumns: buildCuratorGridTemplate(columns, editing) }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="truncate text-sm font-medium text-foreground">{name}</div>
        {tags}
      </div>
      {visible.map((col, i) => (
        <div
          key={col.filterKey}
          className={cn(
            'text-right text-sm tabular-nums tracking-tight text-foreground',
            col.filterKey === 'liquidity' && 'whitespace-normal'
          )}
        >
          {optionalCells[i] ?? '—'}
        </div>
      ))}
      <div className="text-right text-sm tabular-nums tracking-tight text-foreground">
        {allocationAmount}
      </div>
      <div className="text-right">{percentAllocated}</div>
      {targetCell}
    </div>
  );
}
