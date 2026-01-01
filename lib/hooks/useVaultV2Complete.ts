import { useVault } from './useProtocolStats';
import { useVaultV2Risk } from './useVaultV2Risk';
import { useVaultV2Governance } from './useVaultV2Governance';

export function useVaultV2Complete(vaultAddress: string | null | undefined) {
  const vault = useVault(vaultAddress || '');
  const risk = useVaultV2Risk(vaultAddress);
  const governance = useVaultV2Governance(vaultAddress);

  // Return vault loading state separately so pages can block only on vault data
  // Other data will load in parallel and components handle their own loading states
  const isLoading = vault.isLoading || risk.isLoading || governance.isLoading;
  const isError = vault.isError || risk.isError || governance.isError;
  const error = vault.error || risk.error || governance.error;

  return {
    vault: vault.data,
    risk: risk.data,
    governance: governance.data,
    isLoading,
    vaultIsLoading: vault.isLoading, // Separate vault loading state
    isError,
    error,
  };
}

