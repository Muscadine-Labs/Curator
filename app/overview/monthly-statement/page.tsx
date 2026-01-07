'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardAction, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCompactUSD } from '@/lib/format/number';
import { QUERY_STALE_TIME_MEDIUM, QUERY_REFETCH_INTERVAL_MEDIUM } from '@/lib/constants';
import { getAddress } from 'viem';
import Link from 'next/link';
import { Info } from 'lucide-react';

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

interface DefiLlamaMonthlyData {
  month: string;
  grossProtocolRevenue: number;
  assetsYields: number;
  costOfRevenue: number;
  grossProfit: number;
  earnings: number;
}

interface DefiLlamaStatementResponse {
  statements: DefiLlamaMonthlyData[];
}

type YearFilter = '2025' | '2026' | 'all';
type ViewMode = 'total' | 'byToken' | 'byVault';
type CurrencyMode = 'usd' | 'token';
type TabMode = 'treasury' | 'defillama';
type DefiLlamaViewMode = 'month' | 'quarter' | 'year';

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
  const [activeTab, setActiveTab] = useState<TabMode>('treasury');
  const [yearFilter, setYearFilter] = useState<YearFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('byToken');
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('usd');
  const [defiLlamaViewMode, setDefiLlamaViewMode] = useState<DefiLlamaViewMode>('month');
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [isViewModeDropdownOpen, setIsViewModeDropdownOpen] = useState(false);
  const [isDefiLlamaViewModeDropdownOpen, setIsDefiLlamaViewModeDropdownOpen] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState<string | null>(null);
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const viewModeDropdownRef = useRef<HTMLDivElement>(null);
  const defiLlamaViewModeDropdownRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery<MonthlyStatementResponse>({
    queryKey: ['monthly-statement'],
    queryFn: async () => {
      const response = await fetch('/api/monthly-statement-morphoql', {
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
      const response = await fetch('/api/monthly-statement-morphoql?perVault=true', {
        credentials: 'omit',
      });
      if (!response.ok) throw new Error('Failed to fetch vault statement');
      return response.json();
    },
    enabled: viewMode === 'byVault' && activeTab === 'treasury',
    staleTime: QUERY_STALE_TIME_MEDIUM,
    refetchInterval: QUERY_REFETCH_INTERVAL_MEDIUM,
  });

  const { data: defiLlamaData, isLoading: isDefiLlamaLoading, error: defiLlamaError } = useQuery<DefiLlamaStatementResponse>({
    queryKey: ['monthly-statement-defillama'],
    queryFn: async () => {
      const response = await fetch('/api/monthly-statement-defillama', {
        credentials: 'omit',
      });
      if (!response.ok) throw new Error('Failed to fetch DefiLlama statement');
      return response.json();
    },
    enabled: activeTab === 'defillama',
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

  // Filter DefiLlama statements by year and start from November 2025
  const filteredDefiLlamaStatements = useMemo(() => {
    const allStatements = defiLlamaData?.statements || [];
    
    // Filter to start from November 2025 (2025-11)
    const filtered = allStatements.filter(statement => {
      const [year, month] = statement.month.split('-');
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      
      // Include if year is 2025 and month is November (11) or later, or year is 2026 or later
      if (yearNum > 2025) return true;
      if (yearNum === 2025 && monthNum >= 11) return true;
      return false;
    });
    
    // Then apply year filter if not 'all'
    if (yearFilter === 'all') return filtered;
    
    return filtered.filter(statement => {
      const [year] = statement.month.split('-');
      return year === yearFilter;
    });
  }, [defiLlamaData?.statements, yearFilter]);

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

  // Close dropdowns and tooltips when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) {
        setIsYearDropdownOpen(false);
      }
      if (viewModeDropdownRef.current && !viewModeDropdownRef.current.contains(event.target as Node)) {
        setIsViewModeDropdownOpen(false);
      }
      if (defiLlamaViewModeDropdownRef.current && !defiLlamaViewModeDropdownRef.current.contains(event.target as Node)) {
        setIsDefiLlamaViewModeDropdownOpen(false);
      }
      // Close tooltips when clicking outside
      const target = event.target as HTMLElement;
      if (!target.closest('[data-tooltip-container]')) {
        setTooltipVisible(null);
      }
    };

    if (isYearDropdownOpen || isViewModeDropdownOpen || isDefiLlamaViewModeDropdownOpen || tooltipVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isYearDropdownOpen, isViewModeDropdownOpen, isDefiLlamaViewModeDropdownOpen, tooltipVisible]);

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

  const defiLlamaViewModeOptions: { value: DefiLlamaViewMode; label: string }[] = [
    { value: 'month', label: 'Month' },
    { value: 'quarter', label: 'Quarter' },
    { value: 'year', label: 'Year' },
  ];

  const getYearLabel = (value: YearFilter) => {
    return yearOptions.find(opt => opt.value === value)?.label || 'All';
  };

  const getViewModeLabel = (value: ViewMode) => {
    return viewModeOptions.find(opt => opt.value === value)?.label || 'By Token';
  };

  const getDefiLlamaViewModeLabel = (value: DefiLlamaViewMode) => {
    return defiLlamaViewModeOptions.find(opt => opt.value === value)?.label || 'Month';
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

  const isLoadingData = activeTab === 'treasury' 
    ? (isLoading || (viewMode === 'byVault' && isVaultDataLoading))
    : isDefiLlamaLoading;

  // Aggregate DefiLlama data by period (month, quarter, year)
  const aggregatedDefiLlamaData = useMemo(() => {
    if (defiLlamaViewMode === 'month') {
      return filteredDefiLlamaStatements;
    }

    const aggregated = new Map<string, DefiLlamaMonthlyData>();

    filteredDefiLlamaStatements.forEach(statement => {
      const [year, month] = statement.month.split('-').map(Number);
      let periodKey: string;

      if (defiLlamaViewMode === 'quarter') {
        const quarter = Math.ceil(month / 3);
        periodKey = `${year}-Q${quarter}`;
      } else {
        // year
        periodKey = year.toString();
      }

      const existing = aggregated.get(periodKey);
      if (existing) {
        aggregated.set(periodKey, {
          month: periodKey,
          grossProtocolRevenue: existing.grossProtocolRevenue + statement.grossProtocolRevenue,
          assetsYields: existing.assetsYields + statement.assetsYields,
          costOfRevenue: existing.costOfRevenue + statement.costOfRevenue,
          grossProfit: existing.grossProfit + statement.grossProfit,
          earnings: existing.earnings + statement.earnings,
        });
      } else {
        aggregated.set(periodKey, { ...statement, month: periodKey });
      }
    });

    return Array.from(aggregated.values()).sort((a, b) => {
      if (defiLlamaViewMode === 'year') {
        return a.month.localeCompare(b.month);
      }
      // For quarters, sort by year then quarter
      const [yearA, quarterA] = a.month.split('-Q').map((v, i) => i === 0 ? parseInt(v) : parseInt(v));
      const [yearB, quarterB] = b.month.split('-Q').map((v, i) => i === 0 ? parseInt(v) : parseInt(v));
      if (yearA !== yearB) return yearA - yearB;
      return quarterA - quarterB;
    });
  }, [filteredDefiLlamaStatements, defiLlamaViewMode]);

  // Format period label
  const formatPeriod = (periodKey: string) => {
    if (defiLlamaViewMode === 'month') {
      return formatMonth(periodKey);
    } else if (defiLlamaViewMode === 'quarter') {
      const [year, quarter] = periodKey.split('-Q');
      return `Q${quarter} ${year}`;
    } else {
      return periodKey;
    }
  };

  // Check if a period is complete
  const isPeriodComplete = (periodKey: string): boolean => {
    const now = new Date();
    
    if (defiLlamaViewMode === 'month') {
      const [year, month] = periodKey.split('-').map(Number);
      const lastDayOfMonth = new Date(year, month, 0);
      lastDayOfMonth.setHours(23, 59, 59, 999);
      return now > lastDayOfMonth;
    } else if (defiLlamaViewMode === 'quarter') {
      const [year, quarter] = periodKey.split('-Q').map((v, i) => i === 0 ? parseInt(v) : parseInt(v));
      const quarterEndMonth = quarter * 3; // Q1 ends in March (month 3), Q2 in June (6), etc.
      const lastDayOfQuarter = new Date(year, quarterEndMonth, 0);
      lastDayOfQuarter.setHours(23, 59, 59, 999);
      return now > lastDayOfQuarter;
    } else {
      // year
      const year = parseInt(periodKey);
      const lastDayOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
      return now > lastDayOfYear;
    }
  };

  // Calculate totals for DefiLlama view
  const defiLlamaTotals = useMemo(() => {
    return aggregatedDefiLlamaData.reduce((acc, s) => ({
      grossProtocolRevenue: acc.grossProtocolRevenue + s.grossProtocolRevenue,
      assetsYields: acc.assetsYields + s.assetsYields,
      costOfRevenue: acc.costOfRevenue + s.costOfRevenue,
      grossProfit: acc.grossProfit + s.grossProfit,
      earnings: acc.earnings + s.earnings,
    }), {
      grossProtocolRevenue: 0,
      assetsYields: 0,
      costOfRevenue: 0,
      grossProfit: 0,
      earnings: 0,
    });
  }, [aggregatedDefiLlamaData]);

  // Tooltip component for column headers
  const InfoTooltip = ({ id, content }: { id: string; content: string }) => {
    const isVisible = tooltipVisible === id;
    return (
      <div className="relative inline-block" data-tooltip-container>
        <button
          type="button"
          className="inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 rounded"
          onMouseEnter={() => setTooltipVisible(id)}
          onMouseLeave={() => setTooltipVisible(null)}
          onClick={() => setTooltipVisible(isVisible ? null : id)}
          aria-label="More information"
        >
          <Info className="h-4 w-4 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors" />
        </button>
        {isVisible && (
          <div className="absolute right-0 top-6 z-50 w-64 rounded-md border bg-white p-2 text-xs shadow-lg dark:bg-slate-800 dark:border-slate-700 whitespace-normal">
            {content}
          </div>
        )}
      </div>
    );
  };

  return (
    <AppShell
      title="Monthly Income Statement"
      description={
        activeTab === 'treasury' ? (
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
          .<br />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Revenue flows periodically when vaults have activity.
          </span>
        </>
        ) : (
          <>
            Monthly revenue breakdown by asset from November 1st, 2025 onwards through{' '}
            <Link
              href="https://defillama.com/protocol/muscadine"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline dark:text-blue-400 dark:hover:text-blue-300"
            >
              DefiLlama API
            </Link>
            .<br />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Protocol calculations are rounded to the nearest dollar.
            </span>
          </>
        )
      }
    >
      <div className="space-y-6">
          <Card>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabMode)}>
            <CardHeader>
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="treasury">By Treasury Wallet</TabsTrigger>
                  <TabsTrigger value="defillama">DefiLlama</TabsTrigger>
                </TabsList>
                <CardAction>
                  <div className="flex items-center gap-2">
                    {/* Year Filter Dropdown - shown for both tabs */}
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
                    {/* View Mode Dropdown - only for treasury tab */}
                    {activeTab === 'treasury' && (
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
                    )}
                    {/* USD/Token Toggle - only for treasury tab byToken/byVault views */}
                    {activeTab === 'treasury' && (viewMode === 'byToken' || viewMode === 'byVault') && (
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
                    {/* DefiLlama View Mode Dropdown */}
                    {activeTab === 'defillama' && (
                      <div className="relative" ref={defiLlamaViewModeDropdownRef}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsDefiLlamaViewModeDropdownOpen(!isDefiLlamaViewModeDropdownOpen)}
                          className="min-w-[120px] justify-between"
                        >
                          {getDefiLlamaViewModeLabel(defiLlamaViewMode)}
                          <svg
                            className={`ml-2 h-4 w-4 transition-transform ${isDefiLlamaViewModeDropdownOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </Button>
                        {isDefiLlamaViewModeDropdownOpen && (
                          <div className="absolute left-0 mt-1 w-full min-w-[120px] rounded-md border bg-white shadow-lg z-10 dark:bg-slate-800 dark:border-slate-700">
                            {defiLlamaViewModeOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setDefiLlamaViewMode(option.value);
                                  setIsDefiLlamaViewModeDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 first:rounded-t-md last:rounded-b-md ${
                                  defiLlamaViewMode === option.value
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
                    )}
                  </div>
                </CardAction>
              </div>
              </CardHeader>
              <CardContent>
              <TabsContent value="treasury" className="mt-0">
              <div className="mt-4">
                {isLoadingData ? (
                  <Skeleton className="h-64 w-full" />
                ) : error ? (
                  <div className="flex items-center justify-center h-64 text-red-600">
                    Failed to load monthly statement data
                  </div>
                ) : (viewMode === 'total' && statements.length === 0) || 
                    (viewMode === 'byToken' && statements.length === 0) ||
                    (viewMode === 'byVault' && vaultMonths.length === 0) ? (
                  <div className="flex items-center justify-center h-64 text-slate-500">
                    No data available for the specified period
                  </div>
                ) : (
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
                )}
              </div>
            </TabsContent>
            <TabsContent value="defillama" className="mt-0">
              <div className="mt-4">
                {isLoadingData ? (
                  <Skeleton className="h-64 w-full" />
                ) : defiLlamaError ? (
                  <div className="flex items-center justify-center h-64 text-red-600">
                    Failed to load DefiLlama statement data
                  </div>
                ) : aggregatedDefiLlamaData.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-slate-500">
                    No data available for the specified period
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">
                            {defiLlamaViewMode === 'month' ? 'Month' : defiLlamaViewMode === 'quarter' ? 'Quarter' : 'Year'}
                          </TableHead>
                          <TableHead className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              Gross Protocol Revenue
                              <InfoTooltip 
                                id="grossProtocolRevenue" 
                                content="Total yields from deposited assets in all curated vaults." 
                              />
                            </div>
                          </TableHead>
                          <TableHead className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              Cost of Revenue
                              <InfoTooltip 
                                id="costOfRevenue" 
                                content="Yields are distributed to vaults depositors/investors." 
                              />
                            </div>
                          </TableHead>
                          <TableHead className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              Total Revenue
                              <InfoTooltip 
                                id="totalRevenue" 
                                content="Yields are collected by curators." 
                              />
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aggregatedDefiLlamaData.map((statement) => (
                          <TableRow key={statement.month}>
                            <TableCell className="font-medium">
                              {formatPeriod(statement.month)}
                              {!isPeriodComplete(statement.month) && (
                                <span className="ml-2 text-amber-500">*</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCompactUSD(statement.grossProtocolRevenue)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCompactUSD(statement.costOfRevenue)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCompactUSD(statement.grossProfit)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-slate-50 dark:bg-slate-800 font-semibold">
                          <TableCell className="font-semibold">Total</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCompactUSD(defiLlamaTotals.grossProtocolRevenue)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCompactUSD(defiLlamaTotals.costOfRevenue)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCompactUSD(defiLlamaTotals.grossProfit)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>
              </CardContent>
          </Tabs>
            </Card>
      </div>
    </AppShell>
  );
}
