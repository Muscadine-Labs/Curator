'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCompactUSD } from '@/lib/format/number';

interface ChartTvlProps {
  totalData?: Array<{ date: string; value: number }>;
  vaultData?: Array<{
    name: string;
    address: string;
    data: Array<{ date: string; value: number }>;
  }>;
  coinData?: Array<{
    name: string;
    data: Array<{ date: string; value: number }>;
  }>;
  isLoading?: boolean;
  title?: string;
}

// Color palette for coin lines
const COIN_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export function ChartTvl({ totalData, vaultData, coinData, isLoading = false, title = "TVL Over Time" }: ChartTvlProps) {
  const [viewMode, setViewMode] = useState<'total' | 'byCoin'>('total');
  
  // Process coin data into chart format when "By Coin" is selected
  const chartData = useMemo(() => {
    if (viewMode === 'total' || !coinData || coinData.length === 0) {
      return totalData || [];
    }

    // Combine all coin data by date
    const dateMap = new Map<string, Record<string, number | string>>();
    
    coinData.forEach((coin) => {
      coin.data.forEach((point) => {
        if (!dateMap.has(point.date)) {
          dateMap.set(point.date, { date: point.date });
        }
        const entry = dateMap.get(point.date)!;
        entry[coin.name] = point.value;
      });
    });

    // Convert map to array and sort by date
    return Array.from(dateMap.values()).sort((a, b) => 
      new Date(a.date as string).getTime() - new Date(b.date as string).getTime()
    ) as Array<{ date: string; [key: string]: number | string }>;
  }, [viewMode, totalData, coinData]);

  const data = chartData;
  const showToggle = totalData && coinData && coinData.length > 0;

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


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {showToggle && (
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'total' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('total')}
              >
                Total
              </Button>
              <Button
                variant={viewMode === 'byCoin' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('byCoin')}
              >
                By Coin
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
              formatter={(value, name) => {
                if (value === undefined || value === null) return ['N/A', name || 'TVL'];
                const numValue = typeof value === 'number' ? value : Array.isArray(value) ? value[0] : Number(value);
                if (isNaN(numValue)) return ['N/A', name || 'TVL'];
                return [formatTooltipValue(numValue), name || 'TVL'];
              }}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            {viewMode === 'total' ? (
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
              />
            ) : (
              <>
                {coinData?.map((coin, index) => (
                  <Line
                    key={coin.name}
                    type="monotone"
                    dataKey={coin.name}
                    stroke={COIN_COLORS[index % COIN_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    name={coin.name}
                  />
                ))}
                <Legend />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
