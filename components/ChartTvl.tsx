'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCompactUSD } from '@/lib/format/number';

interface ChartTvlProps {
  totalData?: Array<{ date: string; value: number }>;
  vaultData?: Array<{
    name: string;
    address: string;
    key?: string; // Unique key for each vault
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
  
  const cleanSeries = useMemo(() => {
    return (series?: Array<{ date: string; value: number }>) =>
      (series ?? [])
        .map((p) => ({
          date: p.date,
          value: Number.isFinite(p.value) ? Math.max(0, p.value) : 0,
        }))
        .filter((p) => Boolean(p.date));
  }, []);

  // Process vault data into chart format when "By Vault" is selected
  const chartData = useMemo(() => {
    if (viewMode === 'total' || !vaultData || vaultData.length === 0) {
      return cleanSeries(totalData);
    }

    // Normalize dates to day-level precision for matching, but keep original format for display
    // This ensures dates from different vaults align properly even if timestamps differ slightly
    const getDateKey = (dateStr: string): string => {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format for matching
    };

    // Collect all unique dates and their original ISO timestamps
    const dateKeyToOriginalDate = new Map<string, string>(); // normalized -> original ISO
    const vaultDataByDate = new Map<string, Map<string, number>>(); // dateKey -> vaultName -> value
    
    vaultData.forEach((vault) => {
      cleanSeries(vault.data).forEach((point) => {
        if (point.date) {
          const dateKey = getDateKey(point.date);
          dateKeyToOriginalDate.set(dateKey, point.date); // Keep first occurrence as original
          
          if (!vaultDataByDate.has(dateKey)) {
            vaultDataByDate.set(dateKey, new Map());
          }
          vaultDataByDate.get(dateKey)!.set(vault.name, point.value);
        }
      });
    });

    // Track last known value for each vault (for filling missing dates)
    const lastKnownValues = new Map<string, number>();
    
    // Create chart data array with all dates and vault values
    const sortedDateKeys = Array.from(dateKeyToOriginalDate.keys()).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );

    return sortedDateKeys.map((dateKey) => {
      const entry: Record<string, number | string> = { 
        date: dateKeyToOriginalDate.get(dateKey) || dateKey // Use original ISO format
      };
      const dateData = vaultDataByDate.get(dateKey);
      
      // Always include all vaults, using last known value or 0 if no data
      vaultData.forEach((vault) => {
        const value = dateData?.get(vault.name);
        if (value !== undefined) {
          entry[vault.name] = value;
          lastKnownValues.set(vault.name, value); // Update last known value
        } else {
          // Use last known value if available, otherwise 0
          entry[vault.name] = lastKnownValues.get(vault.name) ?? 0;
        }
      });
      
      return entry;
    });
  }, [viewMode, totalData, vaultData, cleanSeries]);

  // All hooks must be called before any early returns
  const formatTooltipValue = useMemo(() => (value: number) => formatCompactUSD(value), []);
  const formatXAxisLabel = useMemo(() => (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

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
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatXAxisLabel}
              tick={{ fontSize: 12 }}
              tickCount={10}
            />
            <YAxis 
              tickFormatter={(value) => formatCompactUSD(value)}
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length || !label) return null;
                
                // Get all vault names from vaultData
                const allVaultNames = viewMode === 'byVault' && vaultData 
                  ? vaultData.map(v => v.name)
                  : [];
                
                // Create entries for all vaults, showing their values or 0
                const tooltipEntries = viewMode === 'byVault' && vaultData
                  ? allVaultNames.map((vaultName, index) => {
                      const payloadEntry = payload.find(p => p.dataKey === vaultName);
                      const value = payloadEntry?.value ?? 0;
                      const numValue = typeof value === 'number' ? value : Array.isArray(value) ? value[0] : Number(value);
                      const displayValue = isNaN(numValue) ? 0 : numValue;
                      const color = VAULT_COLORS[index % VAULT_COLORS.length];
                      
                      return {
                        name: vaultName,
                        value: displayValue,
                        color,
                      };
                    })
                  : payload.map((entry) => ({
                      name: entry.name || 'TVL',
                      value: typeof entry.value === 'number' ? entry.value : Array.isArray(entry.value) ? entry.value[0] : Number(entry.value) || 0,
                      color: entry.color || '#3b82f6',
                    }));
                
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-md">
                    <div className="mb-2 text-sm font-medium">
                      {new Date(label).toLocaleDateString()}
                    </div>
                    {tooltipEntries.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-muted-foreground">{entry.name}:</span>
                        <span className="font-medium">{formatTooltipValue(entry.value)}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
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
                    key={vault.key || vault.address || `vault-${index}`}
                    type="monotone"
                    dataKey={vault.name}
                    stroke={VAULT_COLORS[index % VAULT_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    name={vault.name}
                    connectNulls={true}
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
