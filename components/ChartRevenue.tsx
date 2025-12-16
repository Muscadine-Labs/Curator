'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCompactUSD } from '@/lib/format/number';

interface ChartRevenueProps {
  dailyData?: Array<{ date: string; value: number }>;
  cumulativeData?: Array<{ date: string; value: number }>;
  isLoading?: boolean;
  title?: string;
}

export function ChartRevenue({ dailyData, cumulativeData, isLoading = false, title = "Revenue" }: ChartRevenueProps) {
  const [viewMode, setViewMode] = useState<'daily' | 'cumulative'>('cumulative');
  
  // Use the selected view mode data, fallback to cumulative if daily is not available
  const data = viewMode === 'daily' && dailyData ? dailyData : (cumulativeData || dailyData || []);

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

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatTooltipValue = (value: number) => formatCompactUSD(value);
  const formatXAxisLabel = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const showToggle = dailyData && cumulativeData;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {showToggle && (
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'daily' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('daily')}
              >
                Daily
              </Button>
              <Button
                variant={viewMode === 'cumulative' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('cumulative')}
              >
                Cumulative
              </Button>
            </div>
          )}
        </div>
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
              formatter={(value) => {
                if (value === undefined || value === null) return ['N/A', viewMode === 'daily' ? 'Daily Revenue' : 'Cumulative Revenue'];
                const numValue = typeof value === 'number' ? value : Array.isArray(value) ? value[0] : Number(value);
                if (isNaN(numValue)) return ['N/A', viewMode === 'daily' ? 'Daily Revenue' : 'Cumulative Revenue'];
                return [formatTooltipValue(numValue), viewMode === 'daily' ? 'Daily Revenue' : 'Cumulative Revenue'];
              }}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#8b5cf6" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
