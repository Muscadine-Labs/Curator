#!/usr/bin/env node
/**
 * Print Safe-ready calldata for Morpho send-assets gate rollout.
 * Underlying strategy vaults only — fee wrappers stay open.
 *
 * Usage:
 *   SEND_ASSETS_GATE_ADDRESS=0x… npm run gates:calldata
 */
import { getAddress, type Address } from 'viem';
import {
  SEND_ASSETS_GATE_ADDRESS,
  depositGateFullWhitelist,
  depositGateWhitelistForUnderlying,
  depositGateWrapperAdapterPairs,
  getUnderlyingVaultsForDepositGate,
} from '../lib/config/deposit-gates';
import { getConfiguredVaultDisplayName } from '../lib/config/vaults';
import {
  buildVaultSetSendAssetsGateCalldata,
  encodeGateWhitelistMulticall,
  encodeVaultSubmitCalldata,
} from '../lib/morpho/vault-v2-gates';

function requireGateAddress(): Address {
  if (!SEND_ASSETS_GATE_ADDRESS) {
    console.error(
      'Set SEND_ASSETS_GATE_ADDRESS to the deployed WhitelistSendAssetsGate before running this script.'
    );
    process.exit(1);
  }
  return SEND_ASSETS_GATE_ADDRESS;
}

function printSection(title: string): void {
  console.log(`\n## ${title}\n`);
}

function main(): void {
  const gate = requireGateAddress();
  const full = depositGateFullWhitelist();
  const underlyingAllowlist = depositGateWhitelistForUnderlying();

  printSection('Gate whitelist (once, on WhitelistSendAssetsGate)');
  console.log(`Gate: ${gate}`);
  console.log(`Full whitelist (${full.length} addresses — adapters + partner depositors):`);
  for (const row of full) {
    console.log(`  ${row.address}  — ${row.label}`);
  }
  console.log('\nCurator / whitelister Safe → gate.multicall:');
  console.log(encodeGateWhitelistMulticall(full));

  printSection('Wrapper ↔ adapter pairs (reference — wrappers are NOT gated)');
  for (const pair of depositGateWrapperAdapterPairs()) {
    console.log(`${pair.wrapperLabel}`);
    console.log(`  wrapper:    ${pair.wrapperAddress}  (no setSendAssetsGate)`);
    console.log(`  adapter:    ${pair.adapterAddress}  ← whitelisted on gate`);
    console.log(`  underlying: ${pair.underlyingAddress}  ← setSendAssetsGate here`);
  }

  printSection('Underlying vaults — setSendAssetsGate (blocks direct public deposits)');
  console.log(`Gate allowlist (${underlyingAllowlist.length}):`);
  for (const row of underlyingAllowlist) {
    console.log(`  ${row.address}  — ${row.label}`);
  }
  for (const vault of getUnderlyingVaultsForDepositGate()) {
    const row = buildVaultSetSendAssetsGateCalldata(
      getAddress(vault.address),
      getConfiguredVaultDisplayName(vault),
      gate
    );
    console.log(`\n${row.vaultLabel} (${row.vaultAddress})`);
    console.log(`  submit: vault.submit(${row.submitData})`);
    console.log(`  accept: vault.setSendAssetsGate calldata ${row.acceptData}`);
    console.log(`  timelocked submit wrapper: ${encodeVaultSubmitCalldata(row.submitData)}`);
  }

  printSection('Order of operations');
  console.log('1. Deploy WhitelistSendAssetsGate(roleSetter = Curator Safe) on Base.');
  console.log('2. gate.multicall — whitelist all 9 addresses above.');
  console.log('3. For each underlying vault: Curator Safe vault.submit(setSendAssetsGate calldata).');
  console.log('4. Wait 7 days per vault timelock, then accept (same calldata).');
  console.log('5. npm run gates:verify — RPC check config vs on-chain whitelist (run after every allowlist change).');
  console.log('6. Leave fee-wrapper sendAssetsGate at 0x0 (no change).');
}

main();
