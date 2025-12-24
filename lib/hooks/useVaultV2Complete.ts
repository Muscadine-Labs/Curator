import { useVault } from './useProtocolStats';
import { useVaultV2Risk } from './useVaultV2Risk';
import { useVaultV2Governance } from './useVaultV2Governance';

export function useVaultV2Complete(vaultAddress: string | null | undefined) {
  const vault = useVault(vaultAddress || '');
  const risk = useVaultV2Risk(vaultAddress);
  const governance = useVaultV2Governance(vaultAddress);

  const isLoading = vault.isLoading || risk.isLoading || governance.isLoading;
  const isError = vault.isError || risk.isError || governance.isError;
  const error = vault.error || risk.error || governance.error;

  return {
    vault: vault.data,
    risk: risk.data,
    governance: governance.data,
    isLoading,
    isError,
    error,
  };
}

