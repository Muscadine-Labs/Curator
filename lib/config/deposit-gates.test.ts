import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import {
  DEPOSIT_GATE_DEPOSITOR_ALLOWLIST,
  depositGateAdapterAllowlist,
  depositGateFullWhitelist,
  depositGateGateWhitelisters,
  depositGateWhitelistForUnderlying,
  depositGateWrapperAdapterPairs,
} from '@/lib/config/deposit-gates';
import { TREASURY_ADDRESS } from '@/lib/morpho/treasury-statement';
import {
  buildVaultSetSendAssetsGateCalldata,
  encodeGateSetIsWhitelisted,
  encodeGateWhitelistMulticall,
  encodeSetSendAssetsGateCalldata,
} from '@/lib/morpho/vault-v2-gates';

const GATE = '0x1111111111111111111111111111111111111111';
const VAULT = '0x89712980Cb434eF5aE4AB29349419eb976B0b496';

describe('deposit-gates config', () => {
  it('includes the five partner depositor addresses', () => {
    const expected = [
      '0x628037c2d25f5e5f6f90415cff6d7e8860f41c08',
      TREASURY_ADDRESS,
      '0xf35b121ba32cbeaa27716abeffb6b65a55f9b333',
      '0x31E70f063cA802DedCd76e74C8F6D730eC43D9f0',
      '0x0d5a708b651fee1daa0470431c4262ab3e1d0261',
    ].map((a) => a.toLowerCase());
    const configured = DEPOSIT_GATE_DEPOSITOR_ALLOWLIST.map((row) =>
      row.address.toLowerCase()
    );
    expect(configured).toEqual(expected);
  });

  it('lists four production wrapper ↔ adapter pairs (no test vaults)', () => {
    const pairs = depositGateWrapperAdapterPairs();
    expect(pairs).toHaveLength(4);
    expect(pairs.map((p) => p.wrapperAddress.toLowerCase())).toEqual([
      '0x036a01efddc87f6634ffde0533ee528b90fc7a45',
      '0x54d8417bd21c86a7806b58f5aa2e2e0bb88b856a',
      '0x548653b09b03a69f93b3890c382fe9dcd245cbc4',
      '0x0e0a857d2af1a2d43c82d1fa54766239cab70147',
    ]);
    expect(pairs.map((p) => p.adapterAddress.toLowerCase())).toEqual([
      '0x8b6e43cce1961d3671a39fe8d9e711e69ddd74ce',
      '0x5b211da4cd92cfb9cccfbd1de78289955eb236cd',
      '0xf691616dd2cf85c9ca9fa32bdff00f5cd92bad81',
      '0xa3b90423fd6f70b9f4a424debfb27ac502ac1464',
    ]);
  });

  it('whitelists four adapters, treasury, and four partner depositors on the gate', () => {
    const adapters = depositGateAdapterAllowlist();
    const gate = depositGateWhitelistForUnderlying().map((r) => r.address.toLowerCase());
    expect(adapters).toHaveLength(4);
    for (const adapter of adapters) {
      expect(gate).toContain(adapter.address.toLowerCase());
    }
    for (const row of DEPOSIT_GATE_DEPOSITOR_ALLOWLIST) {
      expect(gate).toContain(row.address.toLowerCase());
    }
    expect(gate).toHaveLength(9);
  });

  it('lists curator and allocator as gate whitelisters', () => {
    const whitelisters = depositGateGateWhitelisters().map((r) => r.address.toLowerCase());
    expect(whitelisters).toEqual([
      '0xb6d1d784e9bc3570546e231cacb52b4e0f1ed8b1',
      '0x2ed45bb3542d06d81d117acd8a561e910a17a618',
    ]);
  });

  it('dedupes treasury in the full whitelist', () => {
    const full = depositGateFullWhitelist();
    const treasuryCount = full.filter(
      (r) => r.address.toLowerCase() === TREASURY_ADDRESS.toLowerCase()
    ).length;
    expect(treasuryCount).toBe(1);
    expect(full).toHaveLength(9);
  });
});

describe('vault-v2-gates encoding', () => {
  it('encodes setSendAssetsGate submit/accept calldata', () => {
    const gate = getAddress(GATE);
    const accept = encodeSetSendAssetsGateCalldata(gate);
    const row = buildVaultSetSendAssetsGateCalldata(getAddress(VAULT), 'USDC Prime', gate);
    expect(row.submitData).toBe(accept);
    expect(row.acceptData).toBe(accept);
    expect(accept.startsWith('0x871c979c')).toBe(true);
  });

  it('encodes gate whitelist multicall', () => {
    const data = encodeGateWhitelistMulticall([
      { address: getAddress(TREASURY_ADDRESS), label: 'Treasury' },
    ]);
    expect(data.startsWith('0x')).toBe(true);
    const single = encodeGateSetIsWhitelisted(getAddress(TREASURY_ADDRESS), true);
    expect(single.startsWith('0x09ec923a')).toBe(true);
  });
});
