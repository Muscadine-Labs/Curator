import { Address } from 'viem';

/**
 * EIP-7702 Proxy contract addresses for Base network
 * Source: https://github.com/base/eip-7702-proxy/releases/tag/v1.0.0
 */
export const EIP7702_CONTRACTS = {
  // EIP7702Proxy template address
  PROXY_TEMPLATE: '0x7702cb554e6bFb442cb743A7dF23154544a7176C' as Address,
  // NonceTracker for preventing replay attacks
  NONCE_TRACKER: '0xD0Ff13c28679FDd75Bc09c0a430a0089bf8b95a8' as Address,
  // DefaultReceiver for handling callbacks
  DEFAULT_RECEIVER: '0x2a8010A9D71D2a5AEA19D040F8b4797789A194a9' as Address,
  // Coinbase Smart Wallet Validator
  VALIDATOR: '0x79A33f950b90C7d07E66950daedf868BD0cDcF96' as Address,
  // Coinbase Smart Wallet Implementation
  CBSW_IMPLEMENTATION: '0x000100abaad02f1cfC8Bbe32bD5a564817339E72' as Address,
} as const;

/**
 * ERC-1967 implementation slot for checking current implementation
 */
export const ERC1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as const;
