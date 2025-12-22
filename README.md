# Muscadine Curator

Modern Next.js dashboard for Muscadine vaults on Morpho. Live data is sourced from the Morpho GraphQL API, DefiLlama, and onchain reads; wallet connection is powered by Wagmi + Coinbase OnchainKit.

## Features

- **Overview Dashboard**: KPI snapshot (TVL, users, fees, interest) with interactive charts
  - TVL chart with toggle between Total and By Vault views
  - Inflows chart with Daily/Cumulative toggle
  - Fees chart with Daily/Cumulative toggle
  - Revenue chart with Daily/Cumulative toggle
- **Dynamic Vault System**: Vaults are automatically categorized and displayed based on names
  - **V1 Vaults**: Automatically detected (vaults without "Prime" or "Vineyard" in name)
  - **V2 Prime Vaults**: Automatically detected (vaults with "Prime" in name)
  - **V2 Vineyard Vaults**: Automatically detected (vaults with "Vineyard" in name)
- **Vault Detail Pages**:
  - **V1 Vaults** (`/vault/v1/[address]`): Overview, Risk Management, Roles, Parameters, Allocation, Caps
    - **V1 Risk Management**: Weighted average risk scores across markets, market-level risk breakdown with component scores (liquidation headroom, utilization, coverage ratio, oracle freshness)
  - **V2 Vaults** (`/vault/v2/[address]`): Overview, Risk Management, Roles, Adapters, Allocations, Caps, Timelock
    - **V2 Risk Management**: Hierarchical risk scoring - vault-level weighted average from adapters, adapter-level weighted averages from markets, and detailed market risk breakdowns per adapter
  - All vault metadata (name, symbol, asset, TVL, APY, performance fee) fetched dynamically from GraphQL
  - Direct links to Morpho UI for each vault
- **Data Sources**: All vault data fetched dynamically from Morpho GraphQL API
- **Revenue & Fees**: Historical data from DefiLlama API
- **Wallet Integration**: Coinbase OnchainKit + wagmi + viem on Base
- **Rate Limiting & Error Handling**: Production-safe API limits and standardized errors

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **State Management**: React Query (TanStack)
- **Wallet**: Coinbase OnchainKit + wagmi + viem
- **Blockchain**: Base (Chain ID: 8453) - All contracts and markets are on Base network
- **RPC**: Alchemy

## Network Configuration

**Everything runs on Base Network (Chain ID: 8453)**

- All vault contracts are deployed on Base
- All Morpho markets are filtered to Base chain only
- Wallet connections default to Base network
- All API queries explicitly filter by `chainId_in: [8453]`

If your wallet is on a different network, the app will prompt you to switch to Base.

## Latest Updates (Jan 2025)

- **V2 Risk Management System**: Complete hierarchical risk analysis for V2 vaults
  - **Vault-Level Risk**: Weighted average risk score across all adapters (by allocation)
  - **Adapter-Level Risk**: Weighted average risk score for each adapter from its underlying markets
  - **Market-Level Risk**: Detailed risk scores per market within each adapter (same scoring as V1)
  - **Support for Adapter Types**: MetaMorphoAdapter (wraps V1 vaults) and MorphoMarketV1Adapter (direct market positions)
  - **Risk Components**: Liquidation headroom, utilization, coverage ratio, oracle freshness (same as V1)
  - **API Endpoint**: `/api/vaults/v2/[id]/risk` returns complete risk hierarchy
- **Dynamic Vault Configuration**: Vault config simplified to only store addresses - all metadata (name, symbol, asset, performance fee, TVL, APY) fetched dynamically from GraphQL
- **Automatic Vault Categorization**: Vaults automatically categorized as V1, V2 Prime, or V2 Vineyard based on their names
- **Interactive Charts with Toggles**:
  - TVL chart: Toggle between Total (aggregated) and By Vault (individual lines)
  - Inflows chart: Toggle between Daily and Cumulative views
  - Fees chart: Toggle between Daily and Cumulative views
  - Revenue chart: Toggle between Daily and Cumulative views
- **Vault Overview Enhancement**: Clean header with vault name (linked to Morpho UI), ticker, and asset badges
- **DefiLlama Integration**: All-time revenue and fees data with daily/cumulative breakdowns
- **Simplified Configuration**: Only vault addresses need to be configured - everything else is dynamic
- **Vault Routes**: V1 vaults at `/vault/v1/[address]`, V2 vaults at `/vault/v2/[address]`
- **Sidebar Navigation**: Dynamically categorizes and displays vaults in appropriate sections
- **Allocation System Refactor (Jan 2025)**:
  - **Correct Morpho V1 Semantics**: `reallocate` now correctly expects FINAL TARGET balances per market, not deltas
  - **New `buildReallocateTargets` Function**: Replaces old delta-based `calculateAllocationChanges` - builds final target allocations matching Morpho Vaults V1 contract requirements
  - **MAX_UINT256 Dust Handling**: Last allocation automatically uses `type(uint256).max` to capture all remaining funds and prevent dust reverts
  - **Market Identification**: Markets identified by `MarketParams` struct (no address conversion needed)
  - **Improved Validation**: Only validates markets with current or target assets, skips markets with missing data if not being allocated to
  - **Enhanced UI**: Allocation table shows token symbols with LTV on left, market info (Utilization, Liquidity, Borrow APY, Supply APY) on right
  - **Missing Data Indicators**: Visual badges show markets with incomplete market parameters

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Copy `.env.example` to `.env.local` and configure:
   ```bash
   cp .env.example .env.local
   ```

   **Note**: The `.env.example` file is blocked by gitignore. See the file structure below for required variables.

   Required environment variables:
   - Server: `COINBASE_CDP_API_KEY` OR `ALCHEMY_API_KEY` (one required, Coinbase CDP preferred)
   - Client: `NEXT_PUBLIC_ALCHEMY_API_KEY` (required), `NEXT_PUBLIC_ONCHAINKIT_API_KEY` (optional)
   - Vault Addresses (optional - defaults provided in code):
     - V1: `NEXT_PUBLIC_VAULT_USDC`, `NEXT_PUBLIC_VAULT_CBBTC`, `NEXT_PUBLIC_VAULT_WETH`
     - V2 Prime: `NEXT_PUBLIC_VAULT_USDC_V2`, `NEXT_PUBLIC_VAULT_WETH_V2`, `NEXT_PUBLIC_VAULT_CBBTC_V2`
   - Optional Protocol Roles: `NEXT_PUBLIC_ROLE_OWNER`, `NEXT_PUBLIC_ROLE_GUARDIAN`, `NEXT_PUBLIC_ROLE_CURATOR`, `NEXT_PUBLIC_ALLOCATOR_HOT`, `NEXT_PUBLIC_ALLOCATOR_IGNAS`
   
   **Note**: All vault metadata (name, symbol, asset, performance fee, etc.) is fetched dynamically from GraphQL. Only addresses need to be configured.

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Open**: http://localhost:3000

## Configuration

### Vaults

Vault configurations are defined in `/lib/config/vaults.ts`. The system uses a simplified configuration where only vault addresses are stored - all other metadata is fetched dynamically from GraphQL.

**To add new vaults:**

1. Add the vault address to the `vaultAddresses` array in `/lib/config/vaults.ts`:
   ```typescript
   {
     address: '0x...',  // Vault contract address
     chainId: 8453,      // Base chain ID
   }
   ```
2. The vault will be automatically categorized based on its name from GraphQL:
   - Names containing "Prime" → V2 Prime Vaults
   - Names containing "Vineyard" → V2 Vineyard Vaults
   - All others → V1 Vaults
3. All metadata (name, symbol, asset, TVL, APY, performance fee) is automatically fetched from GraphQL
4. The vault will appear in the appropriate section of the sidebar
5. No restart needed - changes take effect on next build/deployment

**Current Vaults:**
- 3 V1 Vaults: USDC, cbBTC, WETH
- 3 V2 Prime Vaults: USDC Prime, WETH Prime, cbBTC Prime

### Data Sources

- **Morpho GraphQL API**: 
  - Vault metadata (name, symbol, asset, performance fee)
  - TVL, APY, depositors count
  - Historical TVL data (for V1 vaults)
  - Allocations, positions, rewards
- **DefiLlama API**: 
  - All-time revenue and fees (`/summary/fees/muscadine`)
  - Protocol TVL trends
  - Daily and cumulative breakdowns for fees, revenue, and inflows
- **On-chain**: Protocol roles configuration (optional)

### API Endpoints

- `/api/vaults` - List all vaults with TVL, APY, depositors (fetched from GraphQL)
- `/api/vaults/[id]` - Vault detail with historical data, allocations, roles (fetched from GraphQL)
- `/api/vaults/v1/[id]/market-risk` - V1 vault market risk analysis with weighted scores
- `/api/vaults/v2/[id]/risk` - V2 vault hierarchical risk analysis (vault → adapters → markets)
- `/api/protocol-stats` - Protocol aggregates with interactive chart data:
  - Total TVL trend and per-vault TVL breakdown
  - Daily and cumulative fees trends
  - Daily and cumulative revenue trends
  - Daily and cumulative inflows trends
- `/api/morpho-markets` - Market-level risk ratings (0-100)

References:
- Morpho Earn: https://docs.morpho.org/build/earn/tutorials/get-data
- Morpho Markets: https://docs.morpho.org/build/borrow/tutorials/get-data
- DefiLlama Fees: https://defillama.com/protocol/muscadine

## Project Structure

```
/app
  page.tsx                  # Overview (landing) - protocol stats and trends
  vault/v1/[address]/       # V1 vault detail (Overview, Risk, Roles, Parameters, Allocation, Caps)
  vault/v2/[address]/       # V2 vault detail (Overview, Risk, Roles, Adapters, Allocations, Caps, Timelock)
  layout.tsx                # Root layout
  providers.tsx             # App providers

/app/api
  morpho-markets/route.ts   # Morpho market risk ratings (0-100)
  protocol-stats/route.ts   # Protocol aggregates (TVL, users, fees trends)
  vaults/route.ts           # Vault list (Morpho GraphQL)
  vaults/[id]/route.ts      # Vault detail (Morpho + DefiLlama)
  vaults/v1/[id]/market-risk/route.ts  # V1 vault market risk analysis
  vaults/v2/[id]/risk/route.ts         # V2 vault hierarchical risk analysis

/components
  layout/AppShell.tsx       # Shared shell with sidebar/topbar
  layout/Sidebar.tsx        # Sidebar with dynamically categorized vault list
  layout/Topbar.tsx         # Top bar with wallet/network
  KpiCard.tsx               # KPI display component
  ChartTvl.tsx              # TVL chart with Total/By Vault toggle
  ChartFees.tsx             # Fees chart with Daily/Cumulative toggle
  ChartRevenue.tsx          # Revenue chart with Daily/Cumulative toggle
  ChartInflows.tsx          # Inflows chart with Daily/Cumulative toggle
  AddressBadge.tsx          # Address display with copy/scan
  RoleList.tsx              # Protocol roles (Coming Soon)
  AllocatorList.tsx         # Allocators list (Coming Soon)
  morpho/RatingBadge.tsx    # Risk rating badge
  morpho/AllocationV1.tsx   # V1 vault allocation management with reallocate support
  morpho/MarketRiskV1.tsx   # V1 market risk analysis
  morpho/VaultRiskV1.tsx    # V1 vault-level risk summary
  morpho/VaultRiskV2.tsx    # V2 vault hierarchical risk (vault → adapters → markets)
  ui/*                      # shadcn/ui components

/lib
  config/vaults.ts          # Vault address configurations and categorization helpers
  constants.ts              # Application constants (chain IDs, limits, etc.)
  defillama/service.ts      # DefiLlama API client with chart data processors
  morpho/*                  # Morpho GraphQL client, query helpers, and risk computation
    compute-v1-market-risk.ts  # V1 market risk scoring (liquidation headroom, utilization, coverage, oracle)
    query-v1-vault-markets.ts  # V1 vault markets GraphQL query
    irm-utils.ts              # IRM target utilization helpers
    oracle-utils.ts           # Oracle timestamp and freshness helpers
  hooks/*                   # React Query hooks (useProtocolStats, useVault, useVaultList, useVaultV2Risk)
  format/number.ts          # Number formatting utilities
  wallet/config.ts          # Wallet configuration (wagmi + OnchainKit)
  onchain/*                 # Viem client and contract interfaces
    allocation-utils.ts     # Allocation helpers: buildReallocateTargets, prepareAllocations, validateAllocations
    vault-writes.ts         # Vault write configurations for wagmi
    client.ts               # Viem public client and contract ABIs
  utils/*                   # Utilities (rate limit, error handling, logger)
```

## Deployment

Production readiness:

1. ✅ All tests passing (`npm test`)
2. ✅ Lint checks passing (`npm run lint`)
3. ✅ Build succeeds (`npm run build`)
4. `.env` configured with production Alchemy/WC keys and vault addresses
5. Vaults in `/lib/config/vaults.ts` verified, categories auto-determined by name
6. Wallet integration (RainbowKit + Coinbase OnchainKit) works with Rainbow + other connectors, defaulting to Base network
7. Dashboard enforces Base (Chain ID 8453) by default and prompts for network switch if needed
8. Verify charts and tabs load without missing data; API logs monitored (Morpho GraphQL + DefiLlama)

## Development Notes

- Uses automatic Vercel deployments (no manual deployment needed)
- Vaults list/detail use Morpho API with on-chain fallbacks
- UI tolerates missing fields and renders N/A gracefully
- All components are responsive and accessible
- Charts load with skeleton states for better UX
- **Rate Limiting**: In-memory rate limiting is used. For production at scale, consider using a distributed rate limiting service (e.g., Upstash)
- **Logging**: Development logging goes to console. For production, integrate with a logging service (Winston, Pino, Sentry, etc.)

## Contract Integration

### Vault Contracts
- Generic vault ABI with optional methods
- Resilient reads with try/catch patterns
- Fallback to default values for missing methods

### Allocation System (V1 Vaults)

The allocation system for Morpho Vaults V1 follows the exact semantics required by the `reallocate` function:

**Key Principles:**
- `reallocate(MarketAllocation[])` expects **FINAL TARGET balances**, not deltas
- `MarketAllocation.assets` represents the desired final supply per market
- Markets are identified by `MarketParams` struct (loanToken, collateralToken, oracle, irm, lltv)
- The last allocation must use `MAX_UINT256` to capture all remaining funds (dust handling)

**Functions:**
- `buildReallocateTargets(currentAllocations, targetAllocations)`: Builds final target allocations from current and target states
- `prepareAllocations(allocations, useMaxForLast)`: Converts allocation data to `MarketAllocation[]` format
- `validateAllocations(allocations, currentTotal)`: Validates allocation structure and totals

**Usage Example:**
```typescript
import { buildReallocateTargets } from '@/lib/onchain/allocation-utils';

const currentAllocations = [
  {
    marketId: '0x...',
    supplyAssets: BigInt('1000000000000000000'),
    marketParams: { loanToken, collateralToken, oracle, irm, lltv }
  }
];

const targetAllocations = [
  {
    marketId: '0x...',
    targetAssets: BigInt('2000000000000000000'), // Final desired amount
    marketParams: { loanToken, collateralToken, oracle, irm, lltv }
  }
];

const allocations = buildReallocateTargets(currentAllocations, targetAllocations);
// Last allocation will have assets = MAX_UINT256 for dust handling
```

## Why addresses are in `.env.example`

We include public addresses in `.env.example` so you can:
- Quickly boot the app locally without hunting for values
- Swap to your deployments by editing `.env.local`
- Keep production addresses configurable via CI/CD

No secrets are committed; only public on-chain addresses are shown for convenience. Always set your own values for production.

### Supported Methods
- `asset()`: Vault asset address
- `totalAssets()`: TVL calculation
- `performanceFeeBps()`: Fee rate (defaults to 200 bps)

## Scripts


## Contributing

1. Follow TypeScript best practices
2. Use Tailwind CSS for styling
3. Implement proper error handling
4. Add loading states for better UX
5. Ensure responsive design
6. Test with both mock and on-chain data

## Contact

For questions or support, contact us at: **muscadinelabs@gmail.com**

## License

© 2025 Muscadine. Built on Base.