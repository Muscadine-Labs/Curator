import { NextRequest, NextResponse } from 'next/server';
import { gql } from 'graphql-request';
import { getAddress } from 'viem';
import {
  getActiveVaultAddressesForStats,
  getConfiguredVaultDisplayName,
} from '@/lib/config/vaults';
import { BASE_CHAIN_ID } from '@/lib/constants';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';
import {
  vaultV2TransactionUser,
  type VaultV2TxData,
} from '@/lib/morpho/vault-v2-transaction-utils';
import { handleApiError } from '@/lib/utils/error-handler';
import {
  createRateLimitMiddleware,
  RATE_LIMIT_REQUESTS_PER_MINUTE,
  MINUTE_MS,
} from '@/lib/utils/rate-limit';
import { mergeApiCacheHeaders, API_CACHE_MAX_AGE_MS } from '@/lib/api/response-cache';
import { withServerResponseCache } from '@/lib/api/server-response-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type ProtocolTransaction = {
  hash: string;
  blockNumber: number | null;
  timestamp: number | null;
  type: string;
  user: string | null;
  assets: string | null;
  assetsUsd: number | null;
  vaultAddress: string;
  vaultName: string;
  assetSymbol: string;
  assetDecimals: number | null;
  chainId: number;
};

export type ProtocolTransactionsResponse = {
  transactions: ProtocolTransaction[];
};

const V2_TX_QUERY = gql`
  query ProtocolVaultTransactions(
    $address: String!
    $chainId: Int!
    $first: Int!
    $vaultAddress: [String!]!
    $chainIds: [Int!]
  ) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      name
      asset {
        symbol
        decimals
      }
      totalAssets
      totalAssetsUsd
      totalSupply
    }
    vaultV2transactions(
      first: $first
      skip: 0
      orderBy: Time
      orderDirection: Desc
      where: { vaultAddress_in: $vaultAddress, chainId_in: $chainIds }
    ) {
      items {
        txHash
        blockNumber
        timestamp
        type
        shares
        data {
          __typename
          ... on VaultV2DepositData {
            assets
            onBehalf
            sender
          }
          ... on VaultV2WithdrawData {
            assets
            onBehalf
            receiver
            sender
          }
          ... on VaultV2TransferData {
            from
            to
          }
        }
      }
    }
  }
`;

type V2TxGraphResponse = {
  vaultV2ByAddress?: {
    name?: string | null;
    asset?: { symbol?: string | null; decimals?: number | null } | null;
    totalAssets?: string | number | null;
    totalAssetsUsd?: number | null;
    totalSupply?: string | number | null;
  } | null;
  vaultV2transactions?: {
    items?: Array<{
      txHash?: string | null;
      blockNumber?: number | string | null;
      timestamp?: number | string | null;
      type?: string | null;
      shares?: string | null;
      data?: VaultV2TxData & { assets?: string | number | null };
    } | null> | null;
  } | null;
};

function parseBigIntSafe(value: string | number | null | undefined): bigint | null {
  if (value == null) return null;
  try {
    return BigInt(typeof value === 'number' ? Math.floor(value) : value);
  } catch {
    return null;
  }
}

function sharesToAssets(
  shares: string | null | undefined,
  totalAssets: bigint | null,
  totalSupply: bigint | null
): string | null {
  if (!shares || totalAssets == null || totalSupply == null || totalSupply === 0n) {
    return null;
  }
  try {
    const shareAmount = BigInt(shares);
    if (shareAmount <= 0n) return null;
    return String((shareAmount * totalAssets) / totalSupply);
  } catch {
    return null;
  }
}

function assetsToUsd(
  assets: string | null,
  totalAssets: bigint | null,
  totalAssetsUsd: number | null
): number | null {
  if (!assets || totalAssets == null || totalAssets === 0n || totalAssetsUsd == null) {
    return null;
  }
  try {
    const assetAmount = BigInt(assets);
    if (assetAmount <= 0n) return null;
    return (Number(assetAmount) / Number(totalAssets)) * totalAssetsUsd;
  } catch {
    return null;
  }
}

function mapAssets(
  data: (VaultV2TxData & { assets?: string | number | null }) | null | undefined,
  shares: string | null | undefined,
  totalAssets: bigint | null,
  totalSupply: bigint | null
): string | null {
  if (!data?.__typename) return null;
  if (data.__typename === 'VaultV2DepositData' || data.__typename === 'VaultV2WithdrawData') {
    return data.assets != null ? String(data.assets) : null;
  }
  if (data.__typename === 'VaultV2TransferData') {
    return sharesToAssets(shares, totalAssets, totalSupply);
  }
  return null;
}

export async function GET(request: NextRequest) {
  const rateLimit = createRateLimitMiddleware(RATE_LIMIT_REQUESTS_PER_MINUTE, MINUTE_MS);
  const rateLimitResult = rateLimit(request);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    );
  }

  try {
    const url = new URL(request.url);
    const perVault = Math.min(Number(url.searchParams.get('perVault') || '40'), 100);

    const payload = await withServerResponseCache(
      `protocol-txs-v1-${perVault}`,
      API_CACHE_MAX_AGE_MS,
      async (): Promise<ProtocolTransactionsResponse> => {
        const vaults = getActiveVaultAddressesForStats();
        const results = await Promise.all(
          vaults.map(async (vault) => {
            const address = getAddress(vault.address);
            const chainId = vault.chainId ?? BASE_CHAIN_ID;
            try {
              const data = await morphoGraphQLClient.request<V2TxGraphResponse>(V2_TX_QUERY, {
                address,
                chainId,
                first: perVault,
                vaultAddress: [address.toLowerCase()],
                chainIds: [chainId],
              });
              return { vault, address, chainId, data };
            } catch {
              return {
                vault,
                address,
                chainId,
                data: null as V2TxGraphResponse | null,
              };
            }
          })
        );

        const transactions: ProtocolTransaction[] = [];

        for (const { vault, address, chainId, data } of results) {
          const vaultName =
            data?.vaultV2ByAddress?.name?.trim() ||
            getConfiguredVaultDisplayName(vault);
          const assetSymbol =
            data?.vaultV2ByAddress?.asset?.symbol ?? vault.assetSymbol;
          const assetDecimals = data?.vaultV2ByAddress?.asset?.decimals ?? null;
          const totalAssets = parseBigIntSafe(data?.vaultV2ByAddress?.totalAssets);
          const totalSupply = parseBigIntSafe(data?.vaultV2ByAddress?.totalSupply);
          const totalAssetsUsd = data?.vaultV2ByAddress?.totalAssetsUsd ?? null;

          for (const tx of data?.vaultV2transactions?.items ?? []) {
            if (!tx?.txHash) continue;
            const assets = mapAssets(tx.data, tx.shares, totalAssets, totalSupply);
            transactions.push({
              hash: String(tx.txHash),
              blockNumber: tx.blockNumber != null ? Number(tx.blockNumber) : null,
              timestamp: tx.timestamp != null ? Number(tx.timestamp) : null,
              type: tx.type ?? 'Unknown',
              user: vaultV2TransactionUser(tx.data ?? null),
              assets,
              assetsUsd: assetsToUsd(assets, totalAssets, totalAssetsUsd),
              vaultAddress: address,
              vaultName,
              assetSymbol,
              assetDecimals,
              chainId,
            });
          }
        }

        transactions.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

        return { transactions: transactions.slice(0, 200) };
      }
    );

    const headers = mergeApiCacheHeaders(rateLimitResult.headers, 60);
    return NextResponse.json(payload, { headers });
  } catch (error) {
    const { error: apiError, statusCode } = handleApiError(
      error,
      'Failed to fetch protocol transactions'
    );
    return NextResponse.json(apiError, { status: statusCode });
  }
}
