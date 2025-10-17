import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCompactUSD } from '@/lib/format/number';

interface ChartFeesProps {
  data: Array<{ date: string; value: number }>;
  isLoading?: boolean;
  title?: string;
}

export function ChartFees({ data, isLoading = false, title = "Fees Over Time" }: ChartFeesProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const formatTooltipValue = (value: number) => formatCompactUSD(value);
  const formatXAxisLabel = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatXAxisLabel}
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              tickFormatter={(value) => formatCompactUSD(value)}
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              formatter={(value: number) => [formatTooltipValue(value), 'Fees']}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#10b981" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
