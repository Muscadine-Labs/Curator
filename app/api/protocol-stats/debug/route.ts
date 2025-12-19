import { NextResponse } from 'next/server';
import { vaultAddresses } from '@/lib/config/vaults';
import { BASE_CHAIN_ID } from '@/lib/constants';
import { getAddress } from 'viem';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import { gql } from 'graphql-request';
import { fetchDefiLlamaProtocol } from '@/lib/defillama/service';

type VaultsQueryResponse = {
  vaults?: {
    items?: Array<{
      address?: string;
      name?: string;
      state?: {
        totalAssetsUsd?: number;
      };
    } | null>;
  } | null;
};

type V2VaultQueryResponse = {
  vaultV2ByAddress?: {
    name?: string;
    performanceFee?: number;
  } | null;
};

type V1VaultQueryResponse = {
  vault?: {
    name?: string;
    asset?: {
      symbol?: string;
    } | null;
  } | null;
};

export async function GET() {
  try {
    const addresses = vaultAddresses.map(v => getAddress(v.address));
    
    // Get current TVL for V1 vaults
    const GRAPHQL_FIRST_LIMIT = 1000;
    const query = gql`
      query FetchProtocolStats($addresses: [String!]) {
        vaults(
          first: ${GRAPHQL_FIRST_LIMIT}
          where: { address_in: $addresses, chainId_in: [${BASE_CHAIN_ID}] }
        ) {
          items {
            address
            name
            state { 
              totalAssetsUsd
            }
          }
        }
      }
    `;
    
    const data = await morphoGraphQLClient.request<VaultsQueryResponse>(query, { addresses });
    const morphoVaults = data.vaults?.items?.filter((v): v is NonNullable<typeof v> => v !== null) ?? [];
    const v1VaultCurrentTvl = new Map<string, number>();
    morphoVaults.forEach((v) => {
      if (v.address && v.state?.totalAssetsUsd != null) {
        v1VaultCurrentTvl.set(v.address.toLowerCase(), v.state.totalAssetsUsd);
      }
    });
    
    // Fetch DefiLlama data
    const defiLlamaProtocolData = await fetchDefiLlamaProtocol();
    
    // Check each address
    const debugInfo = await Promise.all(addresses.map(async (address) => {
      try {
        // Check V2
        const v2CheckQuery = gql`
          query CheckV2Vault($address: String!, $chainId: Int!) {
            vaultV2ByAddress(address: $address, chainId: $chainId) {
              name
              performanceFee
            }
          }
        `;
        const v2Result = await morphoGraphQLClient.request<V2VaultQueryResponse>(v2CheckQuery, { address, chainId: BASE_CHAIN_ID });
        
        if (v2Result.vaultV2ByAddress) {
          return {
            address,
            type: 'V2',
            name: v2Result.vaultV2ByAddress.name,
            performanceFee: v2Result.vaultV2ByAddress.performanceFee,
          };
        }
        
        // Check V1
        const v1CheckQuery = gql`
          query CheckVault($address: String!, $chainId: Int!) {
            vault: vaultByAddress(address: $address, chainId: $chainId) {
              name
              asset { symbol }
            }
          }
        `;
        const v1Result = await morphoGraphQLClient.request<V1VaultQueryResponse>(v1CheckQuery, { address, chainId: BASE_CHAIN_ID });
        
        if (v1Result.vault) {
          const currentTvl = v1VaultCurrentTvl.get(address.toLowerCase());
          const hasDefiLlama = !!defiLlamaProtocolData?.tvl;
          const defiLlamaPoints = defiLlamaProtocolData?.tvl?.length ?? 0;
          
          return {
            address,
            type: 'V1',
            name: v1Result.vault.name,
            asset: v1Result.vault.asset?.symbol,
            currentTvl,
            hasDefiLlama,
            defiLlamaPoints,
            wouldHaveData: hasDefiLlama && defiLlamaPoints >= 2,
          };
        }
        
        // Check if we have current TVL from main query (fallback for V1 detection)
        const currentTvl = v1VaultCurrentTvl.get(address.toLowerCase());
        if (currentTvl != null) {
          return {
            address,
            type: 'V1',
            name: undefined,
            asset: undefined,
            currentTvl,
            hasDefiLlama: !!defiLlamaProtocolData?.tvl,
            defiLlamaPoints: defiLlamaProtocolData?.tvl?.length ?? 0,
            wouldHaveData: !!defiLlamaProtocolData?.tvl && (defiLlamaProtocolData?.tvl?.length ?? 0) >= 2,
          };
        }
        
        return {
          address,
          type: 'UNKNOWN',
        };
      } catch (error) {
        // If individual check fails, still check if we have TVL from main query
        const currentTvl = v1VaultCurrentTvl.get(address.toLowerCase());
        if (currentTvl != null) {
          return {
            address,
            type: 'V1',
            name: undefined,
            asset: undefined,
            currentTvl,
            hasDefiLlama: !!defiLlamaProtocolData?.tvl,
            defiLlamaPoints: defiLlamaProtocolData?.tvl?.length ?? 0,
            wouldHaveData: !!defiLlamaProtocolData?.tvl && (defiLlamaProtocolData?.tvl?.length ?? 0) >= 2,
            error: error instanceof Error ? error.message : String(error),
          };
        }
        return {
          address,
          type: 'UNKNOWN',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }));
    
    return NextResponse.json({
      defiLlamaAvailable: !!defiLlamaProtocolData,
      defiLlamaTvlPoints: defiLlamaProtocolData?.tvl?.length ?? 0,
      vaults: debugInfo,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

