#!/usr/bin/env node
/**
 * Propose Curator Safe → gate.setIsWhitelister for one or more Safes.
 *
 * Usage:
 *   GATE_ADDRESS=0xb7… PRIVATE_KEY_8453=0x… ALCHEMY_API_KEY=… \
 *     npx tsx scripts/propose-gate-whitelister.ts
 *
 * Optional: WHITELISTERS=0xAllocator,0xOther (defaults to Allocator Safe from config)
 */
import Safe from '@safe-global/protocol-kit';
import { OperationType } from '@safe-global/types-kit';
import { getAddress, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { depositGateGateWhitelisters } from '../lib/config/deposit-gates';
import { encodeGateAppointWhitelisterCalldata } from '../lib/morpho/vault-v2-gates';
import { getSafeByRole } from '../lib/safe/config';

const CURATOR_SAFE = getAddress(getSafeByRole('curator').address);
const RPC = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const TX_SERVICE = 'https://api.safe.global/tx-service/base/api/v1';
const ORIGIN = 'Curator deposit gate whitelister';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

function resolveWhitelisters(): Address[] {
  const raw = process.env.WHITELISTERS?.trim();
  if (raw) {
    return raw.split(',').map((part) => getAddress(part.trim()));
  }
  const configured = depositGateGateWhitelisters().map((row) => row.address);
  const curator = getAddress(getSafeByRole('curator').address);
  return configured.filter((addr) => addr.toLowerCase() !== curator.toLowerCase());
}

async function main(): Promise<void> {
  const gate = getAddress(requireEnv('GATE_ADDRESS'));
  const privateKey = requireEnv('PRIVATE_KEY_8453') as Hex;
  const proposer = getAddress(privateKeyToAccount(privateKey).address);
  const whitelisters = resolveWhitelisters();

  if (whitelisters.length === 0) {
    console.log('No additional whitelisters to appoint.');
    return;
  }

  const protocolKit = await Safe.init({
    provider: RPC,
    signer: privateKey,
    safeAddress: CURATOR_SAFE,
  });

  const safeInfoRes = await fetch(`${TX_SERVICE}/safes/${CURATOR_SAFE}/`);
  const safeInfo = (await safeInfoRes.json()) as { nonce: number };
  let nonce = Number(safeInfo.nonce);

  console.log(`Gate: ${gate}`);
  console.log(`Proposer: ${proposer}`);

  for (const account of whitelisters) {
    const data = encodeGateAppointWhitelisterCalldata(account, true);
    const safeTransaction = await protocolKit.createTransaction({
      transactions: [{ to: gate, value: '0', data, operation: OperationType.Call }],
      options: { nonce },
    });
    const safeTxHash = (await protocolKit.getTransactionHash(safeTransaction)) as Hex;
    const signature = (await protocolKit.signHash(safeTxHash)).data as Hex;
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
      nonce,
      contractTransactionHash: safeTxHash,
      sender: proposer,
      signature,
      origin: ORIGIN,
    };

    const response = await fetch(`${TX_SERVICE}/safes/${CURATOR_SAFE}/multisig-transactions/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`propose failed (${response.status}) ${await response.text()}`);
    }

    console.log(`\n✓ Proposed setIsWhitelister(${account}, true)`);
    console.log(`  safeTxHash: ${safeTxHash}`);
    console.log(`  nonce: ${nonce}`);
    nonce += 1;
  }

  console.log(
    `\nSafe queue: https://app.safe.global/transactions/queue?safe=base:${CURATOR_SAFE}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
