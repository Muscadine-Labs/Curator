'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCompactUSD } from '@/lib/format/number';
import { filterDataByDate } from '@/lib/utils/date-filter';

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
  
  // Filter data to exclude dates before June 1, 2025
  const filteredTotalData = useMemo(() => filterDataByDate(totalData || []), [totalData]);
  const filteredVaultData = useMemo(() => {
    if (!vaultData) return undefined;
    return vaultData.map(vault => ({
      ...vault,
      data: filterDataByDate(vault.data),
    }));
  }, [vaultData]);
  
  // Process vault data into chart format when "By Vault" is selected
  const chartData = useMemo(() => {
    if (viewMode === 'total' || !filteredVaultData || filteredVaultData.length === 0) {
      return filteredTotalData;
    }

    // First, normalize all vault data points to start of day and deduplicate
    const normalizedVaultData = filteredVaultData.map(vault => {
      // Group points by normalized date and keep the latest value for each day
      const dayMap = new Map<string, { date: string; value: number; timestamp: number }>();
      
      vault.data.forEach((point) => {
        const pointDate = new Date(point.date);
        const normalizedDate = new Date(pointDate);
        normalizedDate.setHours(0, 0, 0, 0);
        const dateKey = normalizedDate.toISOString();
        
        const existing = dayMap.get(dateKey);
        if (!existing || pointDate.getTime() > existing.timestamp) {
          dayMap.set(dateKey, {
            date: dateKey,
            value: point.value,
            timestamp: pointDate.getTime(),
          });
        }
      });
      
      return {
        ...vault,
        data: Array.from(dayMap.values()).map(({ date, value }) => ({ date, value })),
      };
    });

    // Combine all vault data by normalized date
    const dateMap = new Map<string, Record<string, number | string>>();
    
    normalizedVaultData.forEach((vault) => {
      vault.data.forEach((point) => {
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
  }, [viewMode, filteredTotalData, filteredVaultData]);

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

  // Custom tooltip content that sorts vaults by TVL when in "By Vault" mode
  const customTooltipContent = (props: any) => {
    const { active, payload, label } = props;
    
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    // Filter out invalid entries and convert values to numbers
    const validPayload = payload
      .map((entry: any) => {
        const value = typeof entry.value === 'number' ? entry.value : Number(entry.value);
        if (value === null || value === undefined || isNaN(value)) {
          return null;
        }
        return { ...entry, value };
      })
      .filter((entry: any) => entry !== null);

    // Sort payload by value (TVL) in descending order when in "By Vault" mode
    const sortedPayload = viewMode === 'byVault'
      ? [...validPayload].sort((a, b) => b.value - a.value)
      : validPayload;

    if (sortedPayload.length === 0) {
      return null;
    }

    return (
      <div className="rounded-lg border bg-background p-2 sm:p-3 shadow-md max-w-[calc(100vw-2rem)] sm:max-w-none">
        <p className="mb-2 text-xs sm:text-sm font-medium">
          {new Date(label).toLocaleDateString()}
        </p>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {sortedPayload.map((entry: any) => (
            <div key={entry.name || entry.dataKey} className="flex items-center gap-2">
              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs sm:text-sm font-medium truncate">{entry.name || 'TVL'}:</span>
              <span className="text-xs sm:text-sm shrink-0">{formatTooltipValue(entry.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
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
              content={customTooltipContent}
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
                {filteredVaultData?.map((vault, index) => (
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
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
