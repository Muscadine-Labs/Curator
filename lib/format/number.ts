import { format } from 'date-fns';

// Format USD amounts
export const formatUSD = (amount: number | bigint | null, decimals: number = 2): string => {
  if (!amount) return '$0.00';
  
  const numAmount = typeof amount === 'bigint' ? Number(amount) : amount;
  
  if (numAmount === 0) return '$0.00';
  if (numAmount < 0.01) return '<$0.01';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numAmount);
};

// Format compact USD amounts (K, M, B)
export const formatCompactUSD = (amount: number | bigint | null): string => {
  if (!amount) return '$0.00';
  
  const numAmount = typeof amount === 'bigint' ? Number(amount) : amount;
  
  if (numAmount === 0) return '$0.00';
  if (numAmount < 1000) return formatUSD(numAmount, 2);
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return formatter.format(numAmount);
};

// Format percentage
export const formatPercentage = (value: number | null, decimals: number = 2): string => {
  if (value === null || value === undefined) return '0.00%';
  
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
};

// Format basis points to percentage
export const formatBps = (bps: number | null): string => {
  if (!bps) return '0.00%';
  return formatPercentage(bps / 100, 2);
};

// Format large numbers with commas
export const formatNumber = (value: number | bigint | null): string => {
  if (!value) return '0';
  
  const numValue = typeof value === 'bigint' ? Number(value) : value;
  
  return new Intl.NumberFormat('en-US').format(numValue);
};

// Format compact numbers (K, M, B)
export const formatCompactNumber = (value: number | bigint | null): string => {
  if (!value) return '0';
  
  const numValue = typeof value === 'bigint' ? Number(value) : value;
  
  if (numValue < 1000) return numValue.toString();
  
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(numValue);
};

// Format date
export const formatDate = (date: Date | string | number | null): string => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    return format(dateObj, 'MMM dd, yyyy');
  } catch {
    return 'N/A';
  }
};

// Format date with time
export const formatDateTime = (date: Date | string | number | null): string => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    return format(dateObj, 'MMM dd, yyyy HH:mm');
  } catch {
    return 'N/A';
  }
};

// Format relative time (e.g., "2 hours ago")
export const formatRelativeTime = (date: Date | string | number | null): string => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return formatDate(dateObj);
  } catch {
    return 'N/A';
  }
};

// Format address (truncate middle)
export const formatAddress = (address: string | null, startChars: number = 6, endChars: number = 4): string => {
  if (!address) return 'N/A';
  
  if (address.length <= startChars + endChars) return address;
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

// Format token symbol
export const formatTokenSymbol = (symbol: string | null): string => {
  if (!symbol) return 'N/A';
  return symbol.toUpperCase();
};

// Format token amount with decimals
export const formatTokenAmount = (
  amount: bigint | number | null,
  decimals: number,
  displayDecimals: number = 2
): string => {
  if (!amount || !decimals) return '0.00';
  
  const numAmount = typeof amount === 'bigint' ? Number(amount) : amount;
  const divisor = Math.pow(10, decimals);
  const formatted = numAmount / divisor;
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: displayDecimals,
    maximumFractionDigits: displayDecimals,
  }).format(formatted);
};
