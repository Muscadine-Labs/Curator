import { useQuery } from '@tanstack/react-query';

export interface MarketAsset {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number | null;
}

export interface MarketReward {
  asset: {
    address: string;
    symbol: string;
    name: string;
    chain: {
      id: number;
    };
  };
  supplyApr: number;
  borrowApr: number;
  amountPerYear: number | null;
  yearlySupplyTokens: number | null;
  yearlyBorrowTokens: number | null;
}

export interface MarketState {
  collateralAssets: number;
  collateralAssetsUsd: number;
  borrowAssets: number;
  borrowAssetsUsd: number;
  supplyAssets: number;
  supplyAssetsUsd: number;
  liquidityAssets: number;
  liquidityAssetsUsd: number;
  utilization: number;
  supplyApy: number;
  borrowApy: number;
  avgSupplyApy: number | null;
  avgBorrowApy: number | null;
  avgNetSupplyApy: number | null;
  avgNetBorrowApy: number | null;
  fee: number;
  rateAtUTarget: number | null;
  rewards: MarketReward[];
}

export interface MarketWarning {
  type: string;
  level: 'YELLOW' | 'RED';
}

export interface MarketPosition {
  userAddress: string;
  supplyShares: number;
  supplyAssets: number;
  supplyAssetsUsd: number;
  borrowShares: number;
  borrowAssets: number;
  borrowAssetsUsd: number;
  collateral: number;
  collateralUsd: number;
}

export interface MarketLiquidation {
  blockNumber: number;
  hash: string;
  timestamp: number;
  userAddress: string;
  seizedAssets: number;
  repaidAssets: number;
  seizedAssetsUsd: number;
  repaidAssetsUsd: number;
  badDebtAssetsUsd: number;
  liquidator: string;
}

export interface SupplyingVault {
  address: string;
  name: string;
  symbol: string;
  metadata: {
    description: string;
  };
}

export interface MarketDetail {
  uniqueKey: string;
  lltv: number;
  oracleAddress: string;
  irmAddress: string;
  whitelisted: boolean;
  creationBlockNumber: number;
  creationTimestamp: number;
  creatorAddress: string;
  
  loanAsset: MarketAsset;
  collateralAsset: MarketAsset;
  oracle: any;
  oracleInfo: any;
  
  state: MarketState;
  warnings: MarketWarning[];
  
  apyMetrics: {
    daily: any;
    weekly: any;
    monthly: any;
  };
  
  supplyingVaults: SupplyingVault[];
  
  historicalData: {
    supplyApy: Array<{ x: number; y: number }>;
    borrowApy: Array<{ x: number; y: number }>;
    supplyAssetsUsd: Array<{ x: number; y: number }>;
    borrowAssetsUsd: Array<{ x: number; y: number }>;
  };
  
  positions: MarketPosition[];
  liquidations: MarketLiquidation[];
}

export const useMarketDetail = (uniqueKey: string) => {
  return useQuery<MarketDetail>({
    queryKey: ['market-detail', uniqueKey],
    queryFn: async () => {
      const res = await fetch(`/api/markets/${uniqueKey}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch market detail');
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: !!uniqueKey,
  });
};

