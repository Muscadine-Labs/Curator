'use client';

import type { ReactNode } from 'react';
import { CapUtilizationRing } from '@/components/morpho/CapUtilizationRing';
import { CuratorTableShell } from '@/components/morpho/CuratorChrome';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

function AllocationListShell({ children, className }: AllocationListShellProps) {
  return <CuratorTableShell className={cn('overflow-x-auto', className)}>{children}</CuratorTableShell>;
}

/** Morpho Curator–style optional allocation columns. */
const CURATOR_OPTIONAL_COLUMNS: {
  filterKey: keyof AllocationFilterState['columns'];
  label: string;
}[] = [
  { filterKey: 'utilization', label: 'Util.' },
  { filterKey: 'liquidity', label: 'Liquidity' },
  { filterKey: 'effectiveCap', label: 'Eff. Abs. Cap' },
  { filterKey: 'supplyApy', label: 'Rate' },
  { filterKey: 'borrowApy', label: 'Borrow' },
  { filterKey: 'allocated', label: 'Allocated' },
  { filterKey: 'percentCap', label: '% Cap' },
];

export function getCuratorVisibleColumns(columns: AllocationFilterState['columns']) {
  return CURATOR_OPTIONAL_COLUMNS.filter((c) => columns[c.filterKey]);
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

export function CuratorAllocationListHeader({
  editing = false,
  columns = DEFAULT_CURATOR_COLUMNS,
}: {
  editing?: boolean;
  columns?: AllocationFilterState['columns'];
}) {
  const visible = getCuratorVisibleColumns(columns);
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead>Name</TableHead>
        {visible.map((col) => (
          <TableHead key={col.filterKey} className="text-right">
            {col.label}
          </TableHead>
        ))}
        <TableHead className="text-right">Allocation</TableHead>
        <TableHead className="text-right">% Alloc.</TableHead>
        {editing ? <TableHead className="text-right">Target</TableHead> : null}
      </TableRow>
    </TableHeader>
  );
}

export function AllocationPctIndicator({ pct }: { pct: number }) {
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <CapUtilizationRing percent={pct} />
      <span className="tabular-nums text-foreground">{pct.toFixed(2)}%</span>
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
    <TableRow className={className}>
      <TableCell>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{name}</span>
          {tags}
        </div>
      </TableCell>
      {visible.map((col, i) => (
        <TableCell
          key={col.filterKey}
          className={cn(
            'text-right tabular-nums',
            col.filterKey === 'liquidity' && 'whitespace-normal'
          )}
        >
          {optionalCells[i] ?? '—'}
        </TableCell>
      ))}
      <TableCell className="text-right tabular-nums">{allocationAmount}</TableCell>
      <TableCell className="text-right">{percentAllocated}</TableCell>
      {editing ? <TableCell className="text-right">{targetCell}</TableCell> : null}
    </TableRow>
  );
}

export function AllocationTable({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <AllocationListShell>
      <Table>
        {header}
        <TableBody>{children}</TableBody>
      </Table>
    </AllocationListShell>
  );
}
