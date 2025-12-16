# Morpho V1 Vault Allocation Scripts

Scripts for managing allocations and deallocations for Morpho V1 vaults.

## Prerequisites

1. Node.js and npm/yarn installed
2. Environment variables set:
   - `PRIVATE_KEY`: Your wallet private key (for signing transactions)
   - `ALCHEMY_API_KEY` or `COINBASE_CDP_API_KEY`: RPC provider API key

## Scripts

### allocate-v1.ts

Allocate or deallocate funds to/from specific markets.

**Usage:**

```bash
# Single market allocation
tsx scripts/allocate-v1.ts <vault-address> <market-unique-key> <amount> [decimals]

# Multiple markets from JSON file
tsx scripts/allocate-v1.ts <vault-address> --file <path-to-json>
```

**Examples:**

```bash
# Allocate 1000 tokens to a market
tsx scripts/allocate-v1.ts 0x123... 0xabc... 1000

# Allocate with custom decimals (e.g., USDC uses 6)
tsx scripts/allocate-v1.ts 0x123... 0xabc... 1000 6

# Allocate from JSON file
tsx scripts/allocate-v1.ts 0x123... --file ./allocations.json
```

**Allocation file format:**

```json
{
  "vaultAddress": "0x...",
  "decimals": 18,
  "allocations": [
    {
      "uniqueKey": "0x...",
      "amount": "1000.5",
      "decimals": 18
    },
    {
      "uniqueKey": "0x...",
      "amount": "500.0",
      "decimals": 18
    }
  ]
}
```

### rebalance-v1.ts

Rebalance a vault to target allocation percentages.

**Usage:**

```bash
tsx scripts/rebalance-v1.ts <vault-address> --targets <path-to-json>
```

**Example targets file:**

```json
{
  "vaultAddress": "0x...",
  "targets": [
    { "uniqueKey": "0x...", "targetPercent": 50 },
    { "uniqueKey": "0x...", "targetPercent": 30 },
    { "uniqueKey": "0x...", "targetPercent": 20 }
  ]
}
```

**Note:** Target percentages must sum to 100%.

## UI Component

The `AllocationV1` component provides a web interface for managing allocations:

1. Navigate to a V1 vault detail page
2. Click on the "Allocation" tab
3. Click "Reallocate" to enter edit mode
4. Modify allocations for each market
5. Click "Save" to execute the transaction

The UI will:
- Show current allocations and percentages
- Validate that total allocation is correct
- Warn if allocations don't sum to 100%
- Execute the `reallocate` transaction via wallet

## Important Notes

1. **Market Identifiers**: Markets are identified by `uniqueKey` (bytes32). The scripts automatically convert this to address format for contract calls.

2. **Amount Format**: Amounts should be in the vault's native asset units. For example:
   - USDC vault: amounts in USDC (6 decimals)
   - WETH vault: amounts in WETH (18 decimals)

3. **Idle Market**: It's recommended to include the Idle Market as a "catcher" with a large amount (or max uint256) to handle rounding and accrued interest.

4. **Permissions**: Only authorized allocators can call the `reallocate` function. Ensure your wallet is an allocator for the vault.

5. **Gas Costs**: Reallocate transactions can be gas-intensive, especially with many markets. Test on a testnet first.

## Troubleshooting

- **"Vault not found"**: Ensure the vault address is correct and in your configuration
- **"Transaction failed"**: Check that your wallet is an authorized allocator
- **"Invalid uniqueKey"**: Verify the market uniqueKey is correct (64 hex characters)
- **"Allocations don't sum correctly"**: Ensure total allocations match the vault's total assets

