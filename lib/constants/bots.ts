import type { Address } from 'viem';
import { getSafeByRole } from '@/lib/safe/config';

/** EOA that runs Muscadine allocator + sentinel bots on Base. */
export const BOT_EOA_ADDRESS =
  '0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333' as Address;

/** @deprecated Use BOT_EOA_ADDRESS */
export const DEFAULT_BOT_WATCH_ADDRESS = BOT_EOA_ADDRESS;

export const BOT_ROLE_LABELS = {
  allocator: 'Allocator',
  sentinel: 'Sentinel',
  bot: 'Bot',
} as const;

export type BotActorKind = 'bot' | 'allocator_safe' | 'sentinel_safe' | 'other';

export type BotActorInfo = {
  address: Address;
  label: string;
  kind: BotActorKind;
};

export function labelForActor(address: string): BotActorInfo {
  const normalized = address.toLowerCase();
  const allocatorSafe = getSafeByRole('allocator').address.toLowerCase();
  const sentinelSafe = getSafeByRole('sentinel').address.toLowerCase();

  if (normalized === BOT_EOA_ADDRESS.toLowerCase()) {
    return { address: BOT_EOA_ADDRESS, label: 'Bot', kind: 'bot' };
  }
  if (normalized === allocatorSafe) {
    return {
      address: getSafeByRole('allocator').address,
      label: 'Allocator Safe',
      kind: 'allocator_safe',
    };
  }
  if (normalized === sentinelSafe) {
    return {
      address: getSafeByRole('sentinel').address,
      label: 'Sentinel Safe',
      kind: 'sentinel_safe',
    };
  }
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  return {
    address: address as Address,
    label: short,
    kind: 'other',
  };
}
