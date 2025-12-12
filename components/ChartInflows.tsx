'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { formatCompactUSD } from '@/lib/format/number';

interface ChartInflowsProps {
  dailyData: Array<{ date: string; value: number }>;
  cumulativeData: Array<{ date: string; value: number }>;
  isLoading?: boolean;
}

export function ChartInflows({ dailyData, cumulativeData, isLoading = false }: ChartInflowsProps) {
  const [view, setView] = useState<'daily' | 'cumulative'>('daily');
  
  const data = view === 'daily' ? dailyData : cumulativeData;
  const title = view === 'daily' ? 'Inflows (Daily)' : 'Inflows (Cumulative)';

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Inflows</CardTitle>
          <div className="flex gap-1">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-24" />
          </div>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <div className="flex gap-1">
            <Button
              variant={view === 'daily' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('daily')}
            >
              Daily
            </Button>
            <Button
              variant={view === 'cumulative' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('cumulative')}
            >
              Cumulative
            </Button>
          </div>
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <div className="flex gap-1">
          <Button
            variant={view === 'daily' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('daily')}
          >
            Daily
          </Button>
          <Button
            variant={view === 'cumulative' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('cumulative')}
          >
            Cumulative
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          {view === 'daily' ? (
            <BarChart data={data}>
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
                formatter={(value: number) => [formatTooltipValue(value), 'Inflow']}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />
              <Bar 
                dataKey="value" 
                fill="#f59e0b"
              />
            </BarChart>
          ) : (
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
                formatter={(value: number) => [formatTooltipValue(value), 'Cumulative Inflows']}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#f59e0b" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
