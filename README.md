# Muscadine Curator

Modern Next.js dashboard for Muscadine vaults on Morpho. Live data is sourced from the Morpho GraphQL API and onchain reads; wallet connection is powered by Wagmi + Coinbase OnchainKit.

## Features

- **Overview**: KPI snapshot (TVL, users, interest) from Morpho data
- **Vaults**: Six vaults (3 V1, 3 V2 Prime) accessible via sidebar
- **Vault Detail Tabs**: Risk (market-averaged rating), Overview, Roles, Adapters, Allocation, Caps, Timelocks
- **Risk Ratings**: Morpho market ratings (0–100) aggregated per vault
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

## Dune Analytics (optional)

Protocol stats can optionally use Dune fee data if `DUNE_API_KEY` is set; otherwise falls back to Morpho data for TVL/users/fees.

## Latest Updates (Dec 2025)

- Simplified navigation: sidebar with Overview + six vaults (3 V1, 3 V2 Prime)
- Removed legacy allocations, fees, and markets pages/APIs; focused on vault detail flow
- Risk tab now uses Morpho market ratings (0–100) aggregated per vault via `/api/morpho-markets`
- Wallet header uses Coinbase OnchainKit + wagmi on Base
- README and structure updated to match the streamlined layout

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
   - Analytics: `DUNE_API_KEY` (optional, for Dune Analytics fee data integration)

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

- Vault list: Morpho GraphQL (`/api/vaults`) maps TVL and APY fields per Morpho docs
- Vault detail: Morpho GraphQL (`/api/vaults/[id]`) via `vaultByAddress` + positions + allocations + rewards + warnings + queues + txs
- Protocol overview: `/api/protocol-stats` aggregates TVL/users across configured vaults
- Risk ratings: `/api/morpho-markets` computes market-level risk ratings (0-100) from Morpho data

References:
- Earn (vaults/allocations): https://docs.morpho.org/build/earn/tutorials/get-data
- Markets (markets/apy/history): https://docs.morpho.org/build/borrow/tutorials/get-data

## Project Structure

```
/app
  page.tsx                  # Overview (landing) - select vault from sidebar
  vaults/[id]/page.tsx      # Vault detail with tabs (risk, overview, roles, adapters, allocation, caps, timelocks)
  layout.tsx                # Root layout
  providers.tsx             # App providers

/app/api
  morpho-markets/route.ts   # Morpho market risk ratings (0-100)
  protocol-stats/route.ts   # Protocol aggregates (TVL, users, fees)
  vaults/route.ts           # Vault list (Morpho GraphQL)
  vaults/[id]/route.ts      # Vault detail (Morpho GraphQL)

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
  morpho/*                  # Morpho clients, queries, compute helpers
  hooks/*                   # React Query hooks
  format/number.ts          # Number formatting utilities
  wallet/config.ts          # Wallet configuration
  dune/service.ts           # Dune Analytics API service (protocol stats)
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

© 2024 Muscadine. Built on Base.