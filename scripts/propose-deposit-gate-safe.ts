#!/usr/bin/env node
/**
 * Propose Curator Safe txs for deposit gate rollout (after gate deploy).
 *
 * Usage:
 *   GATE_ADDRESS=0x… PRIVATE_KEY_8453=0x… ALCHEMY_API_KEY=… \
 *     node --experimental-strip-types scripts/propose-deposit-gate-safe.ts
 */
import Safe from '@safe-global/protocol-kit';
import { OperationType } from '@safe-global/types-kit';
import { getAddress, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  depositGateFullWhitelist,
  getUnderlyingVaultsForDepositGate,
} from '../lib/config/deposit-gates';
import { getConfiguredVaultDisplayName } from '../lib/config/vaults';
import {
  buildVaultSetSendAssetsGateCalldata,
  encodeGateWhitelistMulticall,
  encodeVaultSubmitCalldata,
} from '../lib/morpho/vault-v2-gates';
import { getSafeByRole } from '../lib/safe/config';

const CURATOR_SAFE = getAddress(getSafeByRole('curator').address);
const RPC = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const TX_SERVICE = 'https://api.safe.global/tx-service/base/api/v1';
const ORIGIN = 'Curator deposit gate rollout';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

async function proposeSafeCall(options: {
  protocolKit: Awaited<ReturnType<typeof Safe.init>>;
  proposer: Address;
  to: Address;
  data: Hex;
  label: string;
  nonce?: number;
}): Promise<{ safeTxHash: Hex; nonce: number }> {
  const safeTransaction = await options.protocolKit.createTransaction({
    transactions: [{ to: options.to, value: '0', data: options.data, operation: OperationType.Call }],
    options: options.nonce != null ? { nonce: options.nonce } : undefined,
  });
  const safeTxHash = (await options.protocolKit.getTransactionHash(safeTransaction)) as Hex;
  const signature = (await options.protocolKit.signHash(safeTxHash)).data as Hex;
  const txData = safeTransaction.data;

  const body = {
    to: getAddress(txData.to),
    value: txData.value,
    data: txData.data,
    operation: txData.operation,
    safeTxGas: txData.safeTxGas,
    baseGas: txData.baseGas,
    gasPrice: txData.gasPrice,
    gasToken: getAddress(txData.gasToken),
    refundReceiver: getAddress(txData.refundReceiver),
    nonce: Number(txData.nonce),
    contractTransactionHash: safeTxHash,
    sender: getAddress(options.proposer),
    signature,
    origin: ORIGIN,
  };

  const response = await fetch(
    `${TX_SERVICE}/safes/${CURATOR_SAFE}/multisig-transactions/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${options.label}: propose failed (${response.status}) ${text}`);
  }

  console.log(`\n✓ Proposed: ${options.label}`);
  console.log(`  safeTxHash: ${safeTxHash}`);
  console.log(`  nonce: ${body.nonce}`);
  console.log(`  to: ${options.to}`);
  console.log(`  safe UI: https://app.safe.global/transactions/queue?safe=base:${CURATOR_SAFE}`);

  return { safeTxHash, nonce: body.nonce };
}

async function main(): Promise<void> {
  const gate = getAddress(requireEnv('GATE_ADDRESS'));
  const privateKey = requireEnv('PRIVATE_KEY_8453') as Hex;
  const proposer = getAddress(privateKeyToAccount(privateKey).address);

  const protocolKit = await Safe.init({
    provider: RPC,
    signer: privateKey,
    safeAddress: CURATOR_SAFE,
  });

  console.log(`Curator Safe: ${CURATOR_SAFE}`);
  console.log(`Proposer:     ${proposer}`);
  console.log(`Gate:         ${gate}`);
  console.log(`Basescan gate: https://basescan.org/address/${gate}`);

  const whitelist = depositGateFullWhitelist();
  const gateMulticall = encodeGateWhitelistMulticall(whitelist);

  const safeInfoRes = await fetch(`${TX_SERVICE}/safes/${CURATOR_SAFE}/`);
  const safeInfo = (await safeInfoRes.json()) as { nonce: number };
  let nextNonce = Number(safeInfo.nonce);

  const proposals: Array<{ label: string; to: Address; data: Hex }> = [
    { label: `Gate whitelist (${whitelist.length} addresses + setIsWhitelister)`, to: gate, data: gateMulticall },
    ...getUnderlyingVaultsForDepositGate().map((vault) => {
      const row = buildVaultSetSendAssetsGateCalldata(
        getAddress(vault.address),
        getConfiguredVaultDisplayName(vault),
        gate
      );
      return {
        label: `Submit setSendAssetsGate — ${row.vaultLabel}`,
        to: getAddress(vault.address),
        data: encodeVaultSubmitCalldata(row.submitData),
      };
    }),
  ];

  for (const proposal of proposals) {
    await proposeSafeCall({
      protocolKit,
      proposer,
      to: proposal.to,
      data: proposal.data,
      label: proposal.label,
      nonce: nextNonce,
    });
    nextNonce += 1;
  }

  console.log('\nDone. Owners must sign and execute the Safe queue.');
  console.log('After 7d timelock per vault, accept with the same setSendAssetsGate calldata.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
