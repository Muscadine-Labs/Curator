import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type RatingBadgeProps = {
  rating: number | null;
  className?: string;
};

type RatingTier = {
  label: string;
  className: string;
};

function getRatingTier(rating: number): RatingTier {
  if (rating >= 85) {
    return {
      label: 'Prime',
      className:
        'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    };
  }
  if (rating >= 70) {
    return {
      label: 'Balanced',
      className:
        'border-sky-500/30 bg-sky-500/15 text-sky-600 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-300',
    };
  }
  if (rating >= 55) {
    return {
      label: 'Watch',
      className:
        'border-amber-500/30 bg-amber-500/15 text-amber-600 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300',
    };
  }
  return {
    label: 'High Risk',
    className:
      'border-rose-500/30 bg-rose-500/15 text-rose-600 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300',
  };
}

export function RatingBadge({ rating, className }: RatingBadgeProps) {
  if (rating === null) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'px-2.5 py-1 text-xs font-semibold border-gray-500/30 bg-gray-500/15 text-gray-600 dark:border-gray-400/20 dark:bg-gray-500/10 dark:text-gray-300',
          className
        )}
        aria-label="Risk rating: Insufficient TVL - market has less than minimum required TVL"
      >
        Insufficient TVL
      </Badge>
    );
  }
  const tier = getRatingTier(rating);
  return (
    <Badge
      variant="outline"
      className={cn('px-2.5 py-1 text-xs font-semibold', tier.className, className)}
      aria-label={`Risk rating: ${tier.label}, score ${rating.toFixed(0)} out of 100`}
    >
      {tier.label} · {rating.toFixed(0)}
    </Badge>
  );
}

