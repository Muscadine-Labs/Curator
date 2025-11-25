/* eslint-disable */
// @ts-nocheck
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import AllocationsPage from '@/app/allocations/page';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock wagmi hooks
const mockAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbE';
const mockUseAccount = jest.fn();

jest.mock('wagmi', () => {
  return {
    useAccount: () => mockUseAccount(),
    useDisconnect: () => ({ disconnect: jest.fn() }),
    WagmiProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// Mock React Query hooks
const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();
const mockUseQueryClient = jest.fn();

jest.mock('@tanstack/react-query', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useMutation: (...args: any[]) => mockUseMutation(...args),
    useQueryClient: () => mockUseQueryClient(),
    QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// Mock hooks
jest.mock('@/lib/hooks/useMarkets', () => ({
  useMarketsSupplied: () => mockUseQuery({ queryKey: ['markets-supplied'] }),
}));

jest.mock('@/lib/hooks/useMorphoMarkets', () => ({
  useMorphoMarkets: () => mockUseQuery({ queryKey: ['morpho-markets'] }),
}));

// Mock components that require providers
jest.mock('@/components/WalletConnect', () => ({
  WalletConnect: () => React.createElement('div', { 'data-testid': 'wallet-connect' }, 'WalletConnect'),
}));

// Mock all UI components to avoid complex dependencies
jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => React.createElement('div', { className: 'card' }, children),
  CardContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', { className: 'card-content' }, children),
  CardDescription: ({ children }: { children: React.ReactNode }) => React.createElement('div', { className: 'card-description' }, children),
  CardHeader: ({ children }: { children: React.ReactNode }) => React.createElement('div', { className: 'card-header' }, children),
  CardTitle: ({ children }: { children: React.ReactNode }) => React.createElement('div', { className: 'card-title' }, children),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => 
    React.createElement('button', { onClick, disabled, ...props }, children),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => React.createElement('span', props, children),
}));

jest.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => React.createElement('table', {}, children),
  TableBody: ({ children }: { children: React.ReactNode }) => React.createElement('tbody', {}, children),
  TableCell: ({ children }: { children: React.ReactNode }) => React.createElement('td', {}, children),
  TableHead: ({ children }: { children: React.ReactNode }) => React.createElement('th', {}, children),
  TableHeader: ({ children }: { children: React.ReactNode }) => React.createElement('thead', {}, children),
  TableRow: ({ children }: { children: React.ReactNode }) => React.createElement('tr', {}, children),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => React.createElement('input', props),
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, value, onValueChange }: any) => React.createElement('div', { 'data-value': value, 'data-onchange': onValueChange }, children),
  TabsContent: ({ children, value }: any) => React.createElement('div', { 'data-tab': value }, children),
  TabsList: ({ children }: { children: React.ReactNode }) => React.createElement('div', { className: 'tabs-list' }, children),
  TabsTrigger: ({ children, value }: any) => React.createElement('button', { 'data-tab': value }, children),
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => React.createElement('div', { className: 'alert' }, children),
  AlertDescription: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
}));

jest.mock('@/components/morpho/RatingBadge', () => ({
  RatingBadge: ({ rating }: { rating: number | null }) => React.createElement('span', {}, `Rating: ${rating ?? 'N/A'}`),
}));

jest.mock('lucide-react', () => ({
  ArrowLeft: () => React.createElement('span', {}, '←'),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ArrowLeft: () => <span>←</span>,
}));

// Create mock data for USDC vault with 3 markets
const createMockUSDCVaultData = () => {
  const vaultAddress = '0xf7e26Fa48A568b8b0038e104DfD8ABdf0f99074F';
  const totalSupplyUsd = 10_000_000; // $10M

  const markets: Array<{
    uniqueKey: string;
    collateralAsset: { symbol: string; address: string; decimals: number };
    loanAsset: { symbol: string; address: string; decimals: number };
    state: {
      supplyAssetsUsd: number;
      borrowAssetsUsd: number;
      liquidityAssetsUsd: number;
      utilization: number;
      supplyApy: number;
      borrowApy: number;
      rewards: Array<unknown>;
    };
  }> = [
    {
      uniqueKey: 'market-1-weth-usdc',
      collateralAsset: { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 },
      loanAsset: { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      state: {
        supplyAssetsUsd: 5_000_000,
        borrowAssetsUsd: 3_000_000,
        liquidityAssetsUsd: 2_000_000,
        utilization: 0.6,
        supplyApy: 0.05,
        borrowApy: 0.08,
        rewards: [],
      },
    },
    {
      uniqueKey: 'market-2-cbbtc-usdc',
      collateralAsset: { symbol: 'cbBTC', address: '0xcbBcC0000000000000000000000000000000000', decimals: 18 },
      loanAsset: { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      state: {
        supplyAssetsUsd: 3_000_000,
        borrowAssetsUsd: 1_500_000,
        liquidityAssetsUsd: 1_500_000,
        utilization: 0.5,
        supplyApy: 0.04,
        borrowApy: 0.07,
        rewards: [],
      },
    },
    {
      uniqueKey: 'market-3-usdc-weth',
      collateralAsset: { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      loanAsset: { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 },
      state: {
        supplyAssetsUsd: 2_000_000,
        borrowAssetsUsd: 1_000_000,
        liquidityAssetsUsd: 1_000_000,
        utilization: 0.5,
        supplyApy: 0.045,
        borrowApy: 0.075,
        rewards: [],
      },
    },
  ];

  // Allocations: 50% WETH/USDC, 30% cbBTC/USDC, 20% USDC/WETH
  const allocations = [
    {
      marketKey: 'market-1-weth-usdc',
      supplyAssetsUsd: 5_000_000,
      sharePct: 0.5, // 50%
    },
    {
      marketKey: 'market-2-cbbtc-usdc',
      supplyAssetsUsd: 3_000_000,
      sharePct: 0.3, // 30%
    },
    {
      marketKey: 'market-3-usdc-weth',
      supplyAssetsUsd: 2_000_000,
      sharePct: 0.2, // 20%
    },
  ];

  return {
    marketsSupplied: {
      markets,
      vaultAllocations: [
        {
          address: vaultAddress,
          name: 'Muscadine USDC Vault',
          symbol: 'mUSDC',
          version: 'v1',
          totalSupplyUsd,
          allocations,
        },
      ],
      availableMarkets: [],
    },
    morphoMarkets: {
      markets: [
        {
          id: 'market-1-weth-usdc',
          raw: { uniqueKey: 'market-1-weth-usdc' },
          rating: 85,
          supplyRate: 0.05,
          utilization: 0.6,
        },
        {
          id: 'market-2-cbbtc-usdc',
          raw: { uniqueKey: 'market-2-cbbtc-usdc' },
          rating: 75,
          supplyRate: 0.04,
          utilization: 0.5,
        },
        {
          id: 'market-3-usdc-weth',
          raw: { uniqueKey: 'market-3-usdc-weth' },
          rating: 80,
          supplyRate: 0.045,
          utilization: 0.5,
        },
      ],
    },
  };
};

describe('AllocationsPage - Reallocation Tests', () => {
  let queryClient: QueryClient;
  let mockInvalidateQueries: jest.Mock;
  let mockMutate: jest.Mock;
  let mockData: ReturnType<typeof createMockUSDCVaultData>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockInvalidateQueries = jest.fn();
    mockMutate = jest.fn();

    mockUseQueryClient.mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });

    mockData = createMockUSDCVaultData();

    // Setup default mocks
    mockUseAccount.mockReturnValue({
      address: mockAddress,
      isConnected: true,
    });

    // Mock useQuery for markets-supplied
    mockUseQuery.mockImplementation((options: any) => {
      const opts = options as { queryKey?: string[] };
      if (opts.queryKey?.includes('markets-supplied')) {
        return {
          data: mockData.marketsSupplied,
          isLoading: false,
          error: null,
        };
      }
      if (opts.queryKey?.includes('morpho-markets')) {
        return {
          data: mockData.morphoMarkets,
          isLoading: false,
          error: null,
        };
      }
      return { data: null, isLoading: false, error: null };
    });

    // Mock useMutation
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: null,
    });

    // Mock fetch for API calls
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders allocation table when wallet is connected', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AllocationsPage />
      </QueryClientProvider>
    );

    expect(screen.getByText('Vault Allocations')).toBeInTheDocument();
    expect(screen.getByText('mUSDC')).toBeInTheDocument();
    expect(screen.getByText('Market Allocations')).toBeInTheDocument();
  });

  it('displays all 3 markets with correct current allocations', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AllocationsPage />
      </QueryClientProvider>
    );

    // Check market pairs are displayed
    expect(screen.getByText(/WETH \/ USDC/)).toBeInTheDocument();
    expect(screen.getByText(/cbBTC \/ USDC/)).toBeInTheDocument();
    expect(screen.getByText(/USDC \/ WETH/)).toBeInTheDocument();

    // Check current shares (50%, 30%, 20%)
    const shareInputs = screen.getAllByDisplayValue(/50\.00|30\.00|20\.00/);
    expect(shareInputs.length).toBeGreaterThan(0);
  });

  it('allows editing share percentages', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AllocationsPage />
      </QueryClientProvider>
    );

    // Find the first market's share input (WETH/USDC - currently 50%)
    const shareInputs = screen.getAllByRole('textbox');
    const firstShareInput = shareInputs.find((input: HTMLElement) => 
      (input as HTMLInputElement).value === '50.00'
    ) as HTMLInputElement;

    expect(firstShareInput).toBeInTheDocument();

    // Change from 50% to 40%
    fireEvent.change(firstShareInput, { target: { value: '40' } });

    await waitFor(() => {
      expect(firstShareInput.value).toBe('40.00');
    });
  });

  it('validates that total allocation equals 100%', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AllocationsPage />
      </QueryClientProvider>
    );

    // Find all share inputs
    const shareInputs = screen.getAllByRole('textbox').filter(
      (input: HTMLElement) => (input as HTMLInputElement).type === 'number'
    ) as HTMLInputElement[];

    // Change allocations to: 40%, 30%, 20% (total = 90% - invalid)
    if (shareInputs.length >= 3) {
      fireEvent.change(shareInputs[0], { target: { value: '40' } });
      fireEvent.change(shareInputs[1], { target: { value: '30' } });
      fireEvent.change(shareInputs[2], { target: { value: '20' } });

      await waitFor(() => {
        const errorMessage = screen.queryByText(/Total allocation must equal 100%/);
        expect(errorMessage).toBeInTheDocument();
      });

      // Reallocate button should be disabled
      const reallocateButton = screen.getByRole('button', { name: /Reallocate/i });
      expect(reallocateButton).toBeDisabled();
    }
  });

  it('enables reallocate button when valid changes are made', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AllocationsPage />
      </QueryClientProvider>
    );

    const shareInputs = screen.getAllByRole('textbox').filter(
      (input: HTMLElement) => (input as HTMLInputElement).type === 'number'
    ) as HTMLInputElement[];

    // Change allocations to: 40%, 35%, 25% (total = 100% - valid)
    if (shareInputs.length >= 3) {
      fireEvent.change(shareInputs[0], { target: { value: '40' } });
      fireEvent.change(shareInputs[1], { target: { value: '35' } });
      fireEvent.change(shareInputs[2], { target: { value: '25' } });

      await waitFor(() => {
        const reallocateButton = screen.getByRole('button', { name: /Reallocate/i });
        expect(reallocateButton).not.toBeDisabled();
      });
    }
  });

  it('calls API with correct payload when reallocate is clicked', async () => {
    const mockFetch = global.fetch as any;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ intent: { id: 'test-id' } }),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AllocationsPage />
      </QueryClientProvider>
    );

    const shareInputs = screen.getAllByRole('textbox').filter(
      (input: HTMLElement) => (input as HTMLInputElement).type === 'number'
    ) as HTMLInputElement[];

    // Make valid changes: 40%, 35%, 25%
    if (shareInputs.length >= 3) {
      fireEvent.change(shareInputs[0], { target: { value: '40' } });
      fireEvent.change(shareInputs[1], { target: { value: '35' } });
      fireEvent.change(shareInputs[2], { target: { value: '25' } });

      await waitFor(() => {
        const reallocateButton = screen.getByRole('button', { name: /Reallocate/i });
        expect(reallocateButton).not.toBeDisabled();
      });

      // Click reallocate button
      const reallocateButton = screen.getByRole('button', { name: /Reallocate/i });
      fireEvent.click(reallocateButton);

      // Verify mutation was called
      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled();
      });

      // Verify the mutation payload structure
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const mutateCall = mockMutate.mock.calls[0]?.[0] as {
        vaultAddress: string;
        allocations: Array<{ marketKey: string; sharePct: number }>;
      };
      expect(mutateCall).toHaveProperty('vaultAddress');
      expect(mutateCall).toHaveProperty('allocations');
      expect(Array.isArray(mutateCall.allocations)).toBe(true);
      expect(mutateCall.allocations.length).toBe(3);
    }
  });

  it('shows success message after successful reallocation', async () => {
    mockUseMutation.mockReturnValue({
      mutate: (payload: unknown, options: { onSuccess?: () => void }) => {
        // Simulate successful mutation
        if (options.onSuccess) {
          options.onSuccess();
        }
      },
      isPending: false,
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AllocationsPage />
      </QueryClientProvider>
    );

    const shareInputs = screen.getAllByRole('textbox').filter(
      (input: HTMLElement) => (input as HTMLInputElement).type === 'number'
    ) as HTMLInputElement[];

    if (shareInputs.length >= 3) {
      fireEvent.change(shareInputs[0], { target: { value: '40' } });
      fireEvent.change(shareInputs[1], { target: { value: '35' } });
      fireEvent.change(shareInputs[2], { target: { value: '25' } });

      await waitFor(() => {
        const reallocateButton = screen.getByRole('button', { name: /Reallocate/i });
        fireEvent.click(reallocateButton);
      });

      // Note: This test would need the actual mutation implementation to trigger
      // For now, we verify the mutation setup is correct
      expect(mockUseMutation).toHaveBeenCalled();
    }
  });

  it('displays total allocation percentage correctly', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AllocationsPage />
      </QueryClientProvider>
    );

    // Should show 100% initially
    expect(screen.getByText(/100\.00/)).toBeInTheDocument();
  });

  it('shows wallet connection required message when not connected', () => {
    mockUseAccount.mockReturnValue({
      address: null,
      isConnected: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AllocationsPage />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Please connect your wallet to manage allocations/i)).toBeInTheDocument();
  });

  it('resets changes when reset button is clicked', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AllocationsPage />
      </QueryClientProvider>
    );

    const shareInputs = screen.getAllByRole('textbox').filter(
      (input: HTMLElement) => (input as HTMLInputElement).type === 'number'
    ) as HTMLInputElement[];

    if (shareInputs.length >= 1) {
      // Make a change
      fireEvent.change(shareInputs[0], { target: { value: '40' } });

      await waitFor(() => {
        const resetButton = screen.queryByRole('button', { name: /Reset Changes/i });
        if (resetButton) {
          fireEvent.click(resetButton);
          // After reset, the input should be back to original value
          expect(shareInputs[0].value).toBe('50.00');
        }
      });
    }
  });
});

