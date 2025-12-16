# Environment Variables

This document lists all environment variables used in the Curator Interface application.

## Required Environment Variables

### Wallet & RPC Configuration

#### `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (Required)
- **Description**: WalletConnect project ID for RainbowKit wallet connection
- **Usage**: Used in `lib/wallet/config.ts` for RainbowKit configuration
- **Default**: Falls back to `'demo'` (not recommended for production)
- **How to get**: Create a project at [WalletConnect Cloud](https://cloud.walletconnect.com/)
- **Example**: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here`

#### `NEXT_PUBLIC_ALCHEMY_API_KEY` (Recommended)
- **Description**: Alchemy API key for Base mainnet RPC endpoint
- **Usage**: Used in `lib/wallet/config.ts` and `lib/onchain/client.ts` for RPC connections
- **Default**: Falls back to `'demo'` (rate-limited, not for production)
- **How to get**: Create an API key at [Alchemy](https://www.alchemy.com/)
- **Example**: `NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key_here`

#### `ALCHEMY_API_KEY` (Optional - for scripts)
- **Description**: Alchemy API key for CLI scripts (server-side only)
- **Usage**: Used in `scripts/allocate-v1.ts`, `scripts/rebalance-v1.ts`, and `lib/onchain/client.ts`
- **Note**: Can be different from `NEXT_PUBLIC_ALCHEMY_API_KEY` if you want separate keys
- **Example**: `ALCHEMY_API_KEY=your_alchemy_key_here`

#### `COINBASE_CDP_API_KEY` (Optional - alternative RPC)
- **Description**: Coinbase CDP API key as an alternative RPC provider
- **Usage**: Used as fallback in `lib/onchain/client.ts` and CLI scripts
- **Priority**: Lower than Alchemy (only used if Alchemy key is not set)
- **Example**: `COINBASE_CDP_API_KEY=your_coinbase_key_here`

### Contract Addresses (Optional - have defaults)

All contract address environment variables have default values, so they're optional unless you need to override them.

#### Vault Addresses
- `NEXT_PUBLIC_VAULT_USDC_V2` - USDC V2 (Prime) vault address
  - Default: `0x89712980Cb434eF5aE4AB29349419eb976B0b496`
- `NEXT_PUBLIC_VAULT_WETH_V2` - WETH V2 (Prime) vault address
  - Default: `0xd6dcad2f7da91fbb27bda471540d9770c97a5a43`
- `NEXT_PUBLIC_VAULT_CBBTC_V2` - cbBTC V2 (Prime) vault address
  - Default: `0x99dcd0d75822ba398f13b2a8852b07c7e137ec70`
- `NEXT_PUBLIC_VAULT_USDC` - USDC V1 vault address
  - Default: `0xf7e26Fa48A568b8b0038e104DfD8ABdf0f99074F`
- `NEXT_PUBLIC_VAULT_CBBTC` - cbBTC V1 vault address
  - Default: `0xAeCc8113a7bD0CFAF7000EA7A31afFD4691ff3E9`
- `NEXT_PUBLIC_VAULT_WETH` - WETH V1 vault address
  - Default: `0x21e0d366272798da3A977FEBA699FCB91959d120`

#### Role Addresses
- `NEXT_PUBLIC_ROLE_OWNER` - Protocol owner address
  - Default: `0x4E5D3ef790C75682ac4f6d4C1dDCc08b36fC100A`
- `NEXT_PUBLIC_ROLE_GUARDIAN` - Protocol guardian address
  - Default: `0x64e804eEF4F5a53272A8623b563ad2724E98A0a9`
- `NEXT_PUBLIC_ROLE_CURATOR` - Protocol curator address
  - Default: `0xb6d1d784e9Bc3570546e231caCB52B4E0f1ED8b1`

#### Allocator Addresses
- `NEXT_PUBLIC_ALLOCATOR_HOT` - Muscadine hot wallet allocator
  - Default: `0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333`
- `NEXT_PUBLIC_ALLOCATOR_IGNAS` - Ignas smart wallet allocator
  - Default: `0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261`

#### Other Contracts
- `NEXT_PUBLIC_FEE_SPLITTER` - Fee splitter contract address
  - Default: None (must be set if using fee splitter features)

### API Configuration

#### `MORPHO_API_URL` (Optional)
- **Description**: Morpho GraphQL API endpoint URL
- **Usage**: Used in `lib/morpho/config.ts` for Curator configuration
- **Default**: Uses default Morpho API URL if not set
- **Example**: `MORPHO_API_URL=https://api.morpho.org/graphql`

### Script-Specific Variables

#### `PRIVATE_KEY` (Required for CLI scripts)
- **Description**: Private key for signing transactions in CLI scripts
- **Usage**: Used in `scripts/allocate-v1.ts` and `scripts/rebalance-v1.ts`
- **Security**: ⚠️ **NEVER** commit this to version control
- **Format**: Hex string with `0x` prefix
- **Example**: `PRIVATE_KEY=0x1234567890abcdef...`

#### `API_BASE_URL` (Optional - for test scripts)
- **Description**: Base URL for API endpoints (used in test scripts)
- **Usage**: Used in `scripts/test-oracle-timestamps.ts`
- **Default**: `http://localhost:3000`
- **Example**: `API_BASE_URL=http://localhost:3000`

### Curator Configuration (Optional - Advanced)

These are optional environment variables for fine-tuning Curator risk parameters. They have defaults in the code.

- `CURATOR_PRICE_STRESS_PCT` - Price stress percentage
- `CURATOR_LIQUIDITY_STRESS_PCT` - Liquidity stress percentage
- `CURATOR_WEIGHT_UTILIZATION` - Utilization weight
- `CURATOR_WEIGHT_STRESS_EXPOSURE` - Stress exposure weight
- `CURATOR_UTILIZATION_CEILING` - Maximum utilization ceiling
- `CURATOR_UTILIZATION_BUFFER_HOURS` - Utilization buffer in hours
- `CURATOR_MAX_UTILIZATION_BEYOND` - Max utilization beyond ceiling
- `CURATOR_RATE_ALIGNMENT_EPS` - Rate alignment epsilon
- `CURATOR_RATE_ALIGNMENT_HIGH_YIELD_BUFFER` - High yield buffer
- `CURATOR_RATE_ALIGNMENT_HIGH_YIELD_EPS` - High yield epsilon
- `CURATOR_FALLBACK_BENCHMARK_RATE` - Fallback benchmark rate
- `CURATOR_WITHDRAWAL_LIQUIDITY_MIN_PCT` - Minimum withdrawal liquidity
- `CURATOR_INSOLVENCY_TOLERANCE_PCT_TVL` - Insolvency tolerance
- `CURATOR_MIN_TVL_USD` - Minimum TVL in USD

## Minimum Required Setup

For basic functionality, you only need:

```bash
# Required for wallet connection
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# Recommended for RPC (client-side)
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key

# Required for CLI scripts (if using them)
ALCHEMY_API_KEY=your_alchemy_key
PRIVATE_KEY=0x_your_private_key
```

## Environment File Setup

Create a `.env.local` file in the project root:

```bash
# Wallet & RPC
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
ALCHEMY_API_KEY=your_alchemy_key  # For scripts

# Optional: Override contract addresses if needed
# NEXT_PUBLIC_VAULT_USDC=0x...
# NEXT_PUBLIC_ROLE_OWNER=0x...

# Required for CLI scripts
PRIVATE_KEY=0x_your_private_key

# Optional: Morpho API
# MORPHO_API_URL=https://api.morpho.org/graphql
```

## Security Notes

1. **Never commit `.env.local` or `.env` files** - They should be in `.gitignore`
2. **`PRIVATE_KEY`** - Only use for development/testing. For production, use hardware wallets or secure key management
3. **`NEXT_PUBLIC_*` variables** - These are exposed to the browser, so don't put sensitive keys here
4. **Server-side variables** - Variables without `NEXT_PUBLIC_` prefix are only available server-side

## Getting API Keys

### WalletConnect Project ID
1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Sign up / Log in
3. Create a new project
4. Copy the Project ID

### Alchemy API Key
1. Go to [Alchemy](https://www.alchemy.com/)
2. Sign up / Log in
3. Create a new app (select "Base" network)
4. Copy the API key from the app dashboard

### Coinbase CDP API Key (Alternative)
1. Go to [Coinbase Developer Platform](https://portal.cdp.coinbase.com/)
2. Sign up / Log in
3. Create a new API key
4. Copy the API key

