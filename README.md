# Muscadine Curator

Modern Next.js dashboard for Muscadine vaults on Morpho. Live data is sourced from the Morpho GraphQL API, DefiLlama, and onchain reads; wallet connection is powered by Wagmi + Coinbase OnchainKit.

## Features

- **Overview**: KPI snapshot (TVL, users, fees, interest) with historical trends
- **Vaults**: Six vaults (3 V1, 3 V2 Prime) with version-specific pages
- **V1 Vaults** (`/vault/v1/[address]`): Overview, Risk Management, Roles, Parameters, Allocation, Caps
- **V2 Vaults** (`/vault/v2/[address]`): Overview, Risk Management, Roles, Adapters, Allocations, Caps, Timelock
- **Risk Ratings**: Morpho market ratings (0–100) aggregated per vault
- **Revenue & Fees**: All-time revenue and curator fees from DefiLlama
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

- **Vault Routes Reorganized**: V1 vaults at `/vault/v1/[address]`, V2 vaults at `/vault/v2/[address]`
- **DefiLlama Integration**: All-time revenue and fees data from DefiLlama API
- **Simplified Stats**: Single APY field, removed utilization from overview
- **Historical Data**: TVL and fees trends from Morpho GraphQL and DefiLlama
- **Sidebar Navigation**: Direct links to V1 and V2 vault pages

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
   - Server: `ALCHEMY_API_KEY` (required)
   - Client: `NEXT_PUBLIC_ALCHEMY_API_KEY` (required), `NEXT_PUBLIC_ONCHAINKIT_API_KEY` (optional)
   - Addresses:
     - V1: `NEXT_PUBLIC_VAULT_USDC`, `NEXT_PUBLIC_VAULT_CBBTC`, `NEXT_PUBLIC_VAULT_WETH`
     - V2 Prime: `NEXT_PUBLIC_VAULT_USDC_V2`, `NEXT_PUBLIC_VAULT_WETH_V2`, `NEXT_PUBLIC_VAULT_CBBTC_V2`
   - Optional: `NEXT_PUBLIC_DEFAULT_PERF_FEE_BPS`, `NEXT_PUBLIC_ROLE_OWNER`, `NEXT_PUBLIC_ROLE_GUARDIAN`, `NEXT_PUBLIC_ROLE_CURATOR`, `NEXT_PUBLIC_ALLOCATOR_HOT`, `NEXT_PUBLIC_ALLOCATOR_IGNAS`

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Open**: http://localhost:3000

## Configuration

### Vaults

Vault configurations are defined in `/lib/config/vaults.ts`. To add new vaults:

1. Add vault configuration to the `vaults` array
2. Update environment variables if needed
3. Restart the development server

### Data Sources

- **Morpho GraphQL API**: Vault TVL, APY, allocations, positions, rewards, historical data
- **DefiLlama API**: All-time revenue and fees (`/summary/fees/muscadine`)
- **On-chain**: Vault roles, performance fees via viem RPC calls

API Endpoints:
- `/api/vaults` - Vault list with TVL, APY, depositors
- `/api/vaults/[id]` - Vault detail with allocations, roles, historical data, revenue/fees
- `/api/protocol-stats` - Protocol aggregates (TVL, users, fees trends)
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

/components
  layout/AppShell.tsx       # Shared shell with sidebar/topbar
  layout/Sidebar.tsx        # Sidebar with vault list
  layout/Topbar.tsx         # Top bar with wallet/network
  KpiCard.tsx               # KPI display
  ChartTvl.tsx              # TVL chart
  ChartFees.tsx             # Fees chart
  AddressBadge.tsx          # Address display with copy/scan
  RoleList.tsx              # Protocol roles
  AllocatorList.tsx         # Allocators list
  morpho/RatingBadge.tsx    # Risk rating badge
  ui/*                      # UI primitives

/lib
  config/vaults.ts          # Vault configurations (V1/V2)
  constants.ts              # Application constants
  defillama/service.ts      # DefiLlama API client for fees/revenue
  morpho/*                  # Morpho clients, queries, compute helpers
  hooks/*                   # React Query hooks
  format/number.ts          # Number formatting utilities
  wallet/config.ts          # Wallet configuration
  onchain/*                 # Viem client and contracts
  utils/*                   # Utilities (rate limit, error handling, etc.)
```

## Deployment

Production checklist:
1. Set `.env` with production keys and addresses
2. `npm run build` succeeds
3. `npm start` runs and pages load without 500s
4. Verify wallet connection on Base network
5. Monitor logs for Morpho API errors

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