import { useVault } from './useProtocolStats';
import { useVaultRoles } from './useVaultRoles';
import { useVaultCaps } from './useVaultCaps';
import { useVaultQueues } from './useVaultQueues';
import { useVaultV1MarketRisk } from './useVaultV1MarketRisk';
import type { Address } from 'viem';

export function useVaultV1Complete(vaultAddress: string | null | undefined) {
  const vault = useVault(vaultAddress || '');
  const roles = useVaultRoles((vaultAddress as Address) || undefined);
  const caps = useVaultCaps(vaultAddress);
  const queues = useVaultQueues(vaultAddress);
  const marketRisk = useVaultV1MarketRisk(vaultAddress);

  const isLoading = vault.isLoading || roles.isLoading || caps.isLoading || queues.isLoading || marketRisk.isLoading;
  const isError = vault.isError || roles.isError || caps.isError || queues.isError || marketRisk.isError;
  const error = vault.error || roles.error || caps.error || queues.error || marketRisk.error;

  return {
    vault: vault.data,
    roles: roles.data,
    caps: caps.data,
    queues: queues.data,
    marketRisk: marketRisk.data,
    isLoading,
    isError,
    error,
  };
}

