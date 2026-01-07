import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCompactUSD, formatCompactNumber, formatPercentage, formatUSD } from '@/lib/format/number';

interface KpiCardProps {
  title: string;
  value: number | string | null;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
	format?: 'usd' | 'usd_full' | 'number' | 'percentage' | 'raw';
}

export function KpiCard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  isLoading = false,
  format = 'usd'
}: KpiCardProps) {
  const formatValue = (val: number | string | null) => {
    if (val === null || val === undefined) return 'N/A';
    
    switch (format) {
      case 'usd':
        return formatCompactUSD(typeof val === 'string' ? parseFloat(val) : val);
			case 'usd_full':
				return formatUSD(typeof val === 'string' ? parseFloat(val) : val);
      case 'number':
        return formatCompactNumber(typeof val === 'string' ? parseFloat(val) : val);
      case 'percentage':
        return formatPercentage(typeof val === 'string' ? parseFloat(val) : val);
      default:
        return val.toString();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <Skeleton className="h-4 w-24" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            <Skeleton className="h-8 w-20" />
          </div>
          {subtitle && (
            <div className="text-xs text-muted-foreground mt-1">
              <Skeleton className="h-3 w-16" />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {trend && (
          <div className={`text-xs font-medium ${
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend.isPositive ? '+' : ''}{formatPercentage(trend.value)}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(value)}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
