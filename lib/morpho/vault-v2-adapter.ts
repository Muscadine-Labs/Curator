import {
  getConfiguredVaultDisplayName,
  getVaultByAddress,
} from '@/lib/config/vaults';

/** GraphQL `__typename` for Vault V2 → Vault V2 adapters (fee wrappers). */
export const MORPHO_VAULT_V2_ADAPTER_TYPENAME = 'MorphoVaultV2Adapter';

/** GraphQL `type` field on MorphoVaultV2Adapter. */
export const MORPHO_VAULT_V2_ADAPTER_TYPE = 'MorphoVaultV2';

export type VaultV2InnerVaultInfo = {
  address: string;
  name: string | null;
  symbol: string | null;
  avgNetApy?: number | null;
  liquidity?: string | null;
  liquidityUsd?: number | null;
};

export function isMorphoVaultV2Adapter(adapter: {
  __typename?: string | null;
  type?: string | null;
  adapterType?: string | null;
}): boolean {
  const t = adapter.__typename ?? adapter.adapterType ?? adapter.type ?? '';
  return t === MORPHO_VAULT_V2_ADAPTER_TYPENAME || t === MORPHO_VAULT_V2_ADAPTER_TYPE;
}

export function innerVaultLabel(
  inner: { name?: string | null; symbol?: string | null } | null | undefined,
  fallback = 'Inner Vault V2'
): string {
  return inner?.name || inner?.symbol || fallback;
}

export type GraphInnerVaultFields = {
  address?: string | null;
  name?: string | null;
  symbol?: string | null;
  avgNetApy?: number | null;
  liquidity?: string | number | null;
  liquidityUsd?: number | null;
};

/**
 * GraphQL inner vault plus config fallback (`innerVaultAddress` on the wrapper).
 */
export function mergeInnerVaultInfo(
  wrapperVaultAddress: string,
  graph: GraphInnerVaultFields | null | undefined
): VaultV2InnerVaultInfo | null {
  const address = graph?.address || getVaultByAddress(wrapperVaultAddress)?.innerVaultAddress;
  if (!address) return null;
  const childCfg = getVaultByAddress(address);
  const liquidity =
    graph?.liquidity != null && graph.liquidity !== '' ? String(graph.liquidity) : null;
  return {
    address,
    name: graph?.name ?? (childCfg ? getConfiguredVaultDisplayName(childCfg) : null),
    symbol: graph?.symbol ?? childCfg?.assetSymbol ?? null,
    avgNetApy: graph?.avgNetApy ?? null,
    liquidity,
    liquidityUsd: graph?.liquidityUsd ?? null,
  };
}
