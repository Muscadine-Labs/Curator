import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

type MetricCardProps = {
  title: string;
  value: ReactNode;
  description?: ReactNode;
  helper?: ReactNode;
  tone?: 'positive' | 'warning' | 'negative' | 'neutral';
  className?: string;
};

const toneMap: Record<
  NonNullable<MetricCardProps['tone']>,
  { border: string; text: string }
> = {
  positive: {
    border: 'border-emerald-500/30 dark:border-emerald-400/20',
    text: 'text-emerald-600 dark:text-emerald-300',
  },
  warning: {
    border: 'border-amber-500/30 dark:border-amber-400/20',
    text: 'text-amber-600 dark:text-amber-300',
  },
  negative: {
    border: 'border-rose-500/30 dark:border-rose-400/20',
    text: 'text-rose-600 dark:text-rose-300',
  },
  neutral: {
    border: 'border-border/60 dark:border-border/40',
    text: 'text-foreground',
  },
};

export function MetricCard({
  title,
  value,
  description,
  helper,
  tone = 'neutral',
  className,
}: MetricCardProps) {
  const toneClasses = toneMap[tone];
  return (
    <Card className={cn('gap-3 border bg-muted/40 dark:bg-muted/20', toneClasses.border, className)}>
      <CardHeader className="gap-1 px-5 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className={cn('text-2xl font-semibold tracking-tight', toneClasses.text)}>
          {value}
        </div>
        {description ? (
          <CardDescription className="mt-2 text-sm leading-relaxed">
            {description}
          </CardDescription>
        ) : null}
        {helper ? <div className="mt-3 text-xs text-muted-foreground/80">{helper}</div> : null}
      </CardContent>
    </Card>
  );
}

