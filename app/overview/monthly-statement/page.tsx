'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardAction, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatCompactUSD } from '@/lib/format/number';
import { QUERY_STALE_TIME_MEDIUM, QUERY_REFETCH_INTERVAL_MEDIUM } from '@/lib/constants';
import { getAddress } from 'viem';
import Link from 'next/link';

interface MonthlyStatementData {
  month: string;
  assets: {
    USDC: {
      tokens: number;
      usd: number;
    };
    cbBTC: {
      tokens: number;
      usd: number;
    };
    WETH: {
      tokens: number;
      usd: number;
    };
  };
  total: {
    tokens: number;
    usd: number;
  };
  isComplete: boolean;
}

interface VaultMonthlyData {
  vaultAddress: string;
  asset: 'USDC' | 'cbBTC' | 'WETH';
  version: 'v1' | 'v2';
  month: string;
  tokens: number;
  usd: number;
}

interface MonthlyStatementResponse {
  statements: MonthlyStatementData[];
}

interface VaultStatementResponse {
  vaults: VaultMonthlyData[];
}

type YearFilter = '2025' | '2026' | 'all';
type ViewMode = 'total' | 'byToken' | 'byVault';
type CurrencyMode = 'usd' | 'token';

// Vault address to name mapping
const VAULT_NAMES: Record<string, string> = {
  '0xf7e26fa48a568b8b0038e104dfd8abdf0f99074f': 'USDC V1',
  '0x89712980cb434ef5ae4ab29349419eb976b0b496': 'USDC V2',
  '0xaecc8113a7bd0cfaf7000ea7a31affd4691ff3e9': 'cbBTC V1',
  '0x99dcd0d75822ba398f13b2a8852b07c7e137ec70': 'cbBTC V2',
  '0x21e0d366272798da3a977feba699fcb91959d120': 'WETH V1',
  '0xd6dcad2f7da91fbb27bda471540d9770c97a5a43': 'WETH V2',
};

export default function MonthlyStatementPage() {
  const [yearFilter, setYearFilter] = useState<YearFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('byToken');
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('usd');
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [isViewModeDropdownOpen, setIsViewModeDropdownOpen] = useState(false);
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const viewModeDropdownRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery<MonthlyStatementResponse>({
    queryKey: ['monthly-statement'],
    queryFn: async () => {
      const response = await fetch('/api/monthly-statement-v2', {
        credentials: 'omit',
      });
      if (!response.ok) throw new Error('Failed to fetch monthly statement');
      return response.json();
    },
    staleTime: QUERY_STALE_TIME_MEDIUM,
    refetchInterval: QUERY_REFETCH_INTERVAL_MEDIUM,
  });

  const { data: vaultData, isLoading: isVaultDataLoading } = useQuery<VaultStatementResponse>({
    queryKey: ['monthly-statement-vaults'],
    queryFn: async () => {
      const response = await fetch('/api/monthly-statement-v2?perVault=true', {
        credentials: 'omit',
      });
      if (!response.ok) throw new Error('Failed to fetch vault statement');
      return response.json();
    },
    enabled: viewMode === 'byVault',
    staleTime: QUERY_STALE_TIME_MEDIUM,
    refetchInterval: QUERY_REFETCH_INTERVAL_MEDIUM,
  });

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Filter statements by year
  const filteredStatements = useMemo(() => {
    const allStatements = data?.statements || [];
    if (yearFilter === 'all') return allStatements;
    
    return allStatements.filter(statement => {
      const [year] = statement.month.split('-');
      return year === yearFilter;
    });
  }, [data?.statements, yearFilter]);

  // Filter vault data by year
  const filteredVaultData = useMemo(() => {
    const allVaults = vaultData?.vaults || [];
    if (yearFilter === 'all') return allVaults;
    
    return allVaults.filter(vault => {
      const [year] = vault.month.split('-');
      return year === yearFilter;
    });
  }, [vaultData?.vaults, yearFilter]);

  // Format token amount with specific decimals per asset
  const formatTokenAmount = (amount: number, asset: 'USDC' | 'cbBTC' | 'WETH'): string => {
    const decimals = asset === 'USDC' ? 6 : 8; // USDC: 6 decimals, cbBTC/WETH: 8 decimals
    
    if (amount === 0) return `0.${'0'.repeat(decimals)} ${asset}`;
    
    // Use Intl.NumberFormat for proper formatting
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true,
    }).format(amount);
    
    return `${formatted} ${asset}`;
  };

  // Format amount based on currency mode
  const formatAmount = (assetData: { tokens: number; usd: number }, asset: 'USDC' | 'cbBTC' | 'WETH'): string => {
    if (currencyMode === 'token') {
      return formatTokenAmount(assetData.tokens, asset);
    }
    return formatCompactUSD(assetData.usd);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) {
        setIsYearDropdownOpen(false);
      }
      if (viewModeDropdownRef.current && !viewModeDropdownRef.current.contains(event.target as Node)) {
        setIsViewModeDropdownOpen(false);
      }
    };

    if (isYearDropdownOpen || isViewModeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isYearDropdownOpen, isViewModeDropdownOpen]);

  const yearOptions: { value: YearFilter; label: string }[] = [
    { value: '2025', label: '2025' },
    { value: '2026', label: '2026' },
    { value: 'all', label: 'All' },
  ];

  const viewModeOptions: { value: ViewMode; label: string }[] = [
    { value: 'total', label: 'Total' },
    { value: 'byToken', label: 'By Token' },
    { value: 'byVault', label: 'By Vault' },
  ];

  const getYearLabel = (value: YearFilter) => {
    return yearOptions.find(opt => opt.value === value)?.label || 'All';
  };

  const getViewModeLabel = (value: ViewMode) => {
    return viewModeOptions.find(opt => opt.value === value)?.label || 'By Token';
  };

  const statements = filteredStatements;
  const grandTotalUSD = statements.reduce((sum, s) => sum + s.assets.USDC.usd + s.assets.cbBTC.usd + s.assets.WETH.usd, 0);

  // Get unique months from vault data
  const vaultMonths = useMemo(() => {
    const months = new Set(filteredVaultData.map(v => v.month));
    return Array.from(months).sort();
  }, [filteredVaultData]);

  // Get unique vault addresses (normalized to lowercase)
  // Ordered: USDC V1, cbBTC V1, WETH V1, USDC V2, cbBTC V2, WETH V2
  const vaultAddresses = useMemo(() => {
    const addresses = new Set(filteredVaultData.map(v => v.vaultAddress.toLowerCase()));
    const addressArray = Array.from(addresses);
    
    // Define the desired order
    const order: string[] = [
      '0xf7e26fa48a568b8b0038e104dfd8abdf0f99074f', // USDC V1
      '0xaecc8113a7bd0cfaf7000ea7a31affd4691ff3e9', // cbBTC V1
      '0x21e0d366272798da3a977feba699fcb91959d120', // WETH V1
      '0x89712980cb434ef5ae4ab29349419eb976b0b496', // USDC V2
      '0x99dcd0d75822ba398f13b2a8852b07c7e137ec70', // cbBTC V2
      '0xd6dcad2f7da91fbb27bda471540d9770c97a5a43', // WETH V2
    ];
    
    // Sort by the defined order, with any unknown addresses at the end
    return addressArray.sort((a, b) => {
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      
      // If both are in the order, sort by their position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only A is in the order, A comes first
      if (indexA !== -1) return -1;
      // If only B is in the order, B comes first
      if (indexB !== -1) return 1;
      // If neither is in the order, sort alphabetically
      return a.localeCompare(b);
    });
  }, [filteredVaultData]);

  // Group vault data by month
  const vaultDataByMonth = useMemo(() => {
    const grouped: Record<string, VaultMonthlyData[]> = {};
    filteredVaultData.forEach(vault => {
      if (!grouped[vault.month]) {
        grouped[vault.month] = [];
      }
      grouped[vault.month].push(vault);
    });
    return grouped;
  }, [filteredVaultData]);

  // Calculate totals for vault view
  const vaultTotals = useMemo(() => {
    const totals: Record<string, { tokens: number; usd: number }> = {};
    vaultAddresses.forEach(addr => {
      totals[addr] = { tokens: 0, usd: 0 };
      filteredVaultData.forEach(vault => {
        if (vault.vaultAddress.toLowerCase() === addr) {
          totals[addr].tokens += vault.tokens;
          totals[addr].usd += vault.usd;
        }
      });
    });
    return totals;
  }, [vaultAddresses, filteredVaultData]);

  const isLoadingData = isLoading || (viewMode === 'byVault' && isVaultDataLoading);

  return (
    <AppShell
      title="Monthly Income Statement"
      description={
        <>
          Monthly revenue breakdown by asset from November 1st, 2025 onwards to our{' '}
          <Link
            href="https://debank.com/profile/0x057fd8b961eb664baa647a5c7a6e9728faba266a"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            Treasury wallet
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {isLoadingData ? (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Income Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Income Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-64 text-red-600">
                Failed to load monthly statement data
              </div>
            </CardContent>
          </Card>
        ) : (viewMode === 'total' && statements.length === 0) || 
            (viewMode === 'byToken' && statements.length === 0) ||
            (viewMode === 'byVault' && vaultMonths.length === 0) ? (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Income Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-64 text-slate-500">
                No data available for the specified period
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Monthly Income Statement</CardTitle>
                <CardAction>
                  <div className="flex items-center gap-2">
                    {/* USD/Token Toggle - only show for byToken and byVault views */}
                    {(viewMode === 'byToken' || viewMode === 'byVault') && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant={currencyMode === 'usd' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrencyMode('usd')}
                        >
                          USD
                        </Button>
                        <Button
                          variant={currencyMode === 'token' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrencyMode('token')}
                        >
                          Token
                        </Button>
                      </div>
                    )}
                    {/* View Mode Dropdown */}
                    <div className="relative" ref={viewModeDropdownRef}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsViewModeDropdownOpen(!isViewModeDropdownOpen)}
                        className="min-w-[120px] justify-between"
                      >
                        {getViewModeLabel(viewMode)}
                        <svg
                          className={`ml-2 h-4 w-4 transition-transform ${isViewModeDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </Button>
                      {isViewModeDropdownOpen && (
                        <div className="absolute left-0 mt-1 w-full min-w-[120px] rounded-md border bg-white shadow-lg z-10 dark:bg-slate-800 dark:border-slate-700">
                          {viewModeOptions.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                setViewMode(option.value);
                                setIsViewModeDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 first:rounded-t-md last:rounded-b-md ${
                                viewMode === option.value
                                  ? 'bg-slate-100 dark:bg-slate-700 font-medium'
                                  : ''
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Year Filter Dropdown */}
                    <div className="relative" ref={yearDropdownRef}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                        className="min-w-[100px] justify-between"
                      >
                        {getYearLabel(yearFilter)}
                        <svg
                          className={`ml-2 h-4 w-4 transition-transform ${isYearDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </Button>
                      {isYearDropdownOpen && (
                        <div className="absolute right-0 mt-1 w-full min-w-[100px] rounded-md border bg-white shadow-lg z-10 dark:bg-slate-800 dark:border-slate-700">
                          {yearOptions.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                setYearFilter(option.value);
                                setIsYearDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 first:rounded-t-md last:rounded-b-md ${
                                yearFilter === option.value
                                  ? 'bg-slate-100 dark:bg-slate-700 font-medium'
                                  : ''
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  {viewMode === 'total' && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Month</TableHead>
                          <TableHead className="text-right font-semibold">Total Revenue (USD)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statements.map((statement) => (
                          <TableRow key={statement.month}>
                            <TableCell className="font-medium">
                              {formatMonth(statement.month)}
                              {!statement.isComplete && (
                                <span className="ml-2 text-amber-500">*</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCompactUSD(statement.total.usd)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-slate-50 font-semibold">
                          <TableCell className="font-semibold">Total</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCompactUSD(grandTotalUSD)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}

                  {viewMode === 'byToken' && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Month</TableHead>
                        <TableHead className="text-right">
                            {currencyMode === 'usd' ? 'USDC Revenue' : 'USDC'}
                        </TableHead>
                        <TableHead className="text-right">
                            {currencyMode === 'usd' ? 'cbBTC Revenue' : 'cbBTC'}
                        </TableHead>
                        <TableHead className="text-right">
                            {currencyMode === 'usd' ? 'WETH Revenue' : 'WETH'}
                        </TableHead>
                        <TableHead className="text-right font-semibold">
                            {currencyMode === 'usd' ? 'Total Revenue' : 'Total (USD)'}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statements.map((statement) => (
                        <TableRow key={statement.month}>
                          <TableCell className="font-medium">
                            {formatMonth(statement.month)}
                            {!statement.isComplete && (
                              <span className="ml-2 text-amber-500">*</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(statement.assets.USDC, 'USDC')}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(statement.assets.cbBTC, 'cbBTC')}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(statement.assets.WETH, 'WETH')}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCompactUSD(statement.total.usd)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-50 font-semibold">
                        <TableCell className="font-semibold">Total</TableCell>
                        <TableCell className="text-right font-semibold">
                            {currencyMode === 'usd' 
                              ? formatCompactUSD(statements.reduce((sum, s) => sum + s.assets.USDC.usd, 0))
                              : formatTokenAmount(statements.reduce((sum, s) => sum + s.assets.USDC.tokens, 0), 'USDC')
                          }
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                            {currencyMode === 'usd' 
                              ? formatCompactUSD(statements.reduce((sum, s) => sum + s.assets.cbBTC.usd, 0))
                              : formatTokenAmount(statements.reduce((sum, s) => sum + s.assets.cbBTC.tokens, 0), 'cbBTC')
                          }
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                            {currencyMode === 'usd' 
                              ? formatCompactUSD(statements.reduce((sum, s) => sum + s.assets.WETH.usd, 0))
                              : formatTokenAmount(statements.reduce((sum, s) => sum + s.assets.WETH.tokens, 0), 'WETH')
                          }
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCompactUSD(grandTotalUSD)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  )}

                  {viewMode === 'byVault' && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Month</TableHead>
                          {vaultAddresses.map((addr) => (
                            <TableHead key={addr} className="text-right">
                              {VAULT_NAMES[addr.toLowerCase()] || `${addr.slice(0, 6)}...${addr.slice(-4)}`}
                            </TableHead>
                          ))}
                          <TableHead className="text-right font-semibold">
                            {currencyMode === 'usd' ? 'Total Revenue' : 'Total (USD)'}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vaultMonths.map((month) => {
                          const monthVaults = vaultDataByMonth[month] || [];
                          const monthTotalUSD = monthVaults.reduce((sum, v) => sum + v.usd, 0);
                          return (
                            <TableRow key={month}>
                              <TableCell className="font-medium">
                                {formatMonth(month)}
                              </TableCell>
                              {vaultAddresses.map((addr) => {
                                const vaultData = monthVaults.find(v => v.vaultAddress.toLowerCase() === addr);
                                return (
                                  <TableCell key={addr} className="text-right">
                                    {vaultData 
                                      ? (currencyMode === 'usd' 
                                          ? formatCompactUSD(vaultData.usd)
                                          : formatTokenAmount(vaultData.tokens, vaultData.asset))
                                      : '-'
                                    }
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-right font-semibold">
                                {formatCompactUSD(monthTotalUSD)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-slate-50 font-semibold">
                          <TableCell className="font-semibold">Total</TableCell>
                          {vaultAddresses.map((addr) => (
                            <TableCell key={addr} className="text-right font-semibold">
                              {currencyMode === 'usd'
                                ? formatCompactUSD(vaultTotals[addr]?.usd || 0)
                                : (() => {
                                    const vault = filteredVaultData.find(v => v.vaultAddress.toLowerCase() === addr);
                                    return vault 
                                      ? formatTokenAmount(vaultTotals[addr]?.tokens || 0, vault.asset)
                                      : '-';
                                  })()
                              }
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-semibold">
                            {formatCompactUSD(
                              vaultAddresses.reduce((sum, addr) => sum + (vaultTotals[addr]?.usd || 0), 0)
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
