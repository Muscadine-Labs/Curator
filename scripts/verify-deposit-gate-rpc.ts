#!/usr/bin/env node
/**
 * Read on-chain gate state and compare to curator config.
 * Run after every allowlist or gate rollout change — the app does not use these RPC reads.
 *
 * Usage:
 *   npm run gates:verify
 *   SEND_ASSETS_GATE_ADDRESS=0x… npm run gates:verify
 *
 * Requires ALCHEMY_API_KEY or falls back to https://mainnet.base.org
 */
import { createPublicClient, getAddress, http, zeroAddress, type Address } from 'viem';
import { base } from 'viem/chains';
import {
  DEPOSIT_GATE_CONTRACT_ADDRESS,
  DEPOSIT_GATE_DEPOSITOR_ALLOWLIST,
  depositGateFullWhitelist,
  getUnderlyingVaultsForDepositGate,
} from '../lib/config/deposit-gates';
import { getConfiguredVaultDisplayName } from '../lib/config/vaults';
import { vaultV2Abi } from '../lib/onchain/abis';
import { getBaseRpcUrl } from '../lib/onchain/rpc-url';
import { whitelistSendAssetsGateAbi } from '../lib/onchain/whitelist-send-assets-gate-abi';

function redactRpcUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(/\/v2\/[^/]+/i, '/v2/***');
    parsed.pathname = parsed.pathname.replace(/\/v1\/[^/]+/i, '/v1/***');
    parsed.search = '';
    parsed.hash = '';
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return '(rpc)';
  }
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string') return null;
  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const gate = DEPOSIT_GATE_CONTRACT_ADDRESS;
  const rpcUrl = getBaseRpcUrl();
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });

  console.log(`RPC: ${redactRpcUrl(rpcUrl)}`);
  console.log(`Gate: ${gate}\n`);

  let whitelistFailures = 0;
  let wiringFailures = 0;
  let depositorFailures = 0;

  console.log('## Underlying vault sendAssetsGate\n');
  for (const vault of getUnderlyingVaultsForDepositGate()) {
    const vaultAddress = getAddress(vault.address);
    const label = getConfiguredVaultDisplayName(vault);
    const onChainGate = await client.readContract({
      address: vaultAddress,
      abi: vaultV2Abi,
      functionName: 'sendAssetsGate',
    });
    const normalized = normalizeAddress(onChainGate);
    const ok =
      normalized !== null &&
      normalized.toLowerCase() === gate.toLowerCase() &&
      normalized.toLowerCase() !== zeroAddress;
    if (!ok) wiringFailures += 1;
    console.log(
      `${ok ? 'OK' : 'FAIL'}  ${label} (${vaultAddress}) → ${normalized ?? onChainGate}`
    );
  }

  const allVaultsWired = wiringFailures === 0;

  console.log('\n## Gate isWhitelisted (config vs on-chain)\n');
  for (const row of depositGateFullWhitelist()) {
    const whitelisted = await client.readContract({
      address: gate,
      abi: whitelistSendAssetsGateAbi,
      functionName: 'isWhitelisted',
      args: [row.address],
    });
    const ok = whitelisted === true;
    if (!ok) whitelistFailures += 1;
    console.log(
      `${ok ? 'OK' : 'FAIL'}  ${row.address}  — ${row.label}  (isWhitelisted=${whitelisted})`
    );
  }

  console.log('\n## Vault canSendAssets (depositors only)\n');
  if (!allVaultsWired) {
    console.log(
      'SKIP  Timelock pending — sendAssetsGate is still 0x0; canSendAssets is open to all senders until wired.'
    );
  } else {
    const sampleVault = getAddress(getUnderlyingVaultsForDepositGate()[0]!.address);
    for (const row of DEPOSIT_GATE_DEPOSITOR_ALLOWLIST) {
      const allowed = await client.readContract({
        address: sampleVault,
        abi: vaultV2Abi,
        functionName: 'canSendAssets',
        args: [row.address],
      });
      const ok = allowed === true;
      if (!ok) depositorFailures += 1;
      console.log(
        `${ok ? 'OK' : 'FAIL'}  ${row.address}  — ${row.label}  (canSendAssets=${allowed})`
      );
    }
  }

  console.log('\n## Summary\n');
  if (whitelistFailures > 0) {
    console.error(`${whitelistFailures} gate whitelist check(s) failed. Update on-chain gate or config.`);
    process.exit(1);
  }

  if (!allVaultsWired) {
    console.warn(
      `${wiringFailures} underlying vault(s) still need setSendAssetsGate accept (expected pre-rollout).`
    );
    console.log('Gate whitelist matches config. Safe to sync app depositor list.');
    process.exit(0);
  }

  if (depositorFailures > 0) {
    console.error(`${depositorFailures} depositor canSendAssets check(s) failed.`);
    process.exit(1);
  }

  console.log('All gate checks passed. Sync app `src/lib/deposit-gate-config.ts` if config changed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
