import { getAddress } from 'viem';
import { morphoGraphQLClient } from '@/lib/morpho/graphql-client';

type VaultRef = { address: string; chainId: number };

function aliasName(prefix: string, index: number): string {
  return `${prefix}${index}`;
}

/**
 * One GraphQL HTTP round-trip: aliased `vaultV2ByAddress` for each vault.
 * Addresses come from config (checksummed), not request input.
 */
export async function batchVaultV2ByAddress<T>(
  vaults: VaultRef[],
  selection: string
): Promise<Map<string, T | null>> {
  const out = new Map<string, T | null>();
  if (vaults.length === 0) return out;

  const fields = vaults.map((v, i) => {
    const addr = getAddress(v.address);
    return `${aliasName('v', i)}: vaultV2ByAddress(address: "${addr}", chainId: ${v.chainId}) { ${selection} }`;
  });
  const query = `query BatchVaultV2ByAddress {\n${fields.join('\n')}\n}`;

  const data = await morphoGraphQLClient.request<Record<string, T | null>>(query);
  vaults.forEach((v, i) => {
    out.set(v.address.toLowerCase(), data[aliasName('v', i)] ?? null);
  });
  return out;
}

export async function batchVaultV2AllocationTransactions<T>(
  vaults: VaultRef[],
  first: number,
  senders: string[]
): Promise<Map<string, T | null>> {
  const out = new Map<string, T | null>();
  if (vaults.length === 0) return out;

  const senderList = senders.map((s) => `"${getAddress(s)}"`).join(', ');
  const fields = vaults.map((v, i) => {
    const addr = getAddress(v.address);
    return `${aliasName('r', i)}: vaultV2AllocationTransactions(
      vaultAddress: "${addr}"
      chainId: ${v.chainId}
      first: ${first}
      skip: 0
      orderBy: Timestamp
      orderDirection: Desc
      where: { sender_in: [${senderList}] }
    ) { items { txHash blockNumber timestamp type assets change adapter ids sender } }`;
  });
  const query = `query BatchVaultV2Realloc {\n${fields.join('\n')}\n}`;
  const data = await morphoGraphQLClient.request<Record<string, T | null>>(query);
  vaults.forEach((v, i) => {
    out.set(v.address.toLowerCase(), data[aliasName('r', i)] ?? null);
  });
  return out;
}
