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
  isLoading?: boolean;
  title?: string;
}

// Color palette for vault lines
const VAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export function ChartTvl({ totalData, vaultData, isLoading = false, title = "TVL Over Time" }: ChartTvlProps) {
  const [viewMode, setViewMode] = useState<'total' | 'byVault'>('total');
  
  const cleanSeries = (series?: Array<{ date: string; value: number }>) =>
    (series ?? [])
      .map((p) => ({
        date: p.date,
        value: Number.isFinite(p.value) ? Math.max(0, p.value) : 0,
      }))
      .filter((p) => Boolean(p.date));

  // Process vault data into chart format when "By Vault" is selected
  const chartData = useMemo(() => {
    if (viewMode === 'total' || !vaultData || vaultData.length === 0) {
      return cleanSeries(totalData);
    }

    // Combine all vault data by date
    const dateMap = new Map<string, Record<string, number | string>>();
    
    vaultData.forEach((vault) => {
      cleanSeries(vault.data).forEach((point) => {
        if (!dateMap.has(point.date)) {
          dateMap.set(point.date, { date: point.date });
        }
        const entry = dateMap.get(point.date)!;
        entry[vault.name] = point.value;
      });
    });

    // Convert map to array and sort by date
    return Array.from(dateMap.values()).sort((a, b) => 
      new Date(a.date as string).getTime() - new Date(b.date as string).getTime()
    ) as Array<{ date: string; [key: string]: number | string }>;
  }, [viewMode, totalData, vaultData]);

  const data = chartData;
  const showToggle = totalData && vaultData && vaultData.length > 0;

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
                variant={viewMode === 'byVault' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('byVault')}
              >
                By Vault
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
                {vaultData?.map((vault, index) => (
                  <Line
                    key={vault.address}
                    type="monotone"
                    dataKey={vault.name}
                    stroke={VAULT_COLORS[index % VAULT_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    name={vault.name}
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
