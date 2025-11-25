# Muscadine Curator

Modern Next.js dashboard for Muscadine vaults on Morpho. Live data is sourced from the Morpho GraphQL API and onchain reads; wallet connection and fee-claim actions are powered by Wagmi + Coinbase OnchainKit.

## Features

- **Protocol Overview**: KPI dashboard with TVL, total interest generated, and user metrics
- **Vaults Explorer**: Comprehensive view of all 6 Muscadine vaults (3 V1 + 3 V2 Prime) with their market allocations and curator risk ratings (0-100)
- **Vault Details**: Individual vault pages with performance charts and role information
- **Allocation Console**: Interactive allocator workflow to record liquidity allocation and deallocation intents across Morpho markets
- **Fee Splitter**: Integration with multiple ERC20FeeSplitter contracts (V1 and V2) for fee claims
- **Wallet Integration**: Coinbase OnchainKit + wagmi + viem for Base network
- **On-chain Data**: Real-time data from Base chain via Alchemy and Morpho GraphQL API
- **Dune Analytics**: Real-time and historical fee data integration
- **Rate Limiting**: Built-in API rate limiting for production use
- **Error Handling**: Comprehensive error boundaries and standardized error responses
- **Input Sanitization**: All user inputs are validated and sanitized

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
- Fee splitter contract is on Base
- All API queries explicitly filter by `chainId_in: [8453]`

If your wallet is on a different network, the app will prompt you to switch to Base.

## Dune Analytics Integration

The application now integrates with Dune Analytics to fetch real-time fee data and historical trends. This provides more accurate fee analytics compared to the previous mock data.

### Setup

1. **Get Dune API Key**: Sign up at [Dune Analytics](https://dune.com) and generate an API key
2. **Configure Query IDs**: Update the query IDs in `/app/api/dune/fees/route.ts` to match your Dune queries
3. **Set Environment Variable**: Add `DUNE_API_KEY` to your `.env.local` file

### Features

- **Real-time Fee Data**: Fetches actual fee data from Dune queries
- **Historical Trends**: Displays fee trends over time in charts
- **Automatic Fallback**: Falls back to Morpho API data if Dune is unavailable
- **Multi-Vault Support**: Aggregates fee data across all configured vaults

### Query Configuration

The Dune integration uses query ID `5930091` by default (from the provided Dune links). Query IDs are configured in `/lib/constants.ts` under `DUNE_QUERY_IDS`. To use different queries:

1. Update `DUNE_QUERY_IDS` in `/lib/constants.ts`
2. Adjust the parameter mapping in the `transformDuneResultsToFeeData` function to match your query's column names

## Recent Improvements (Dec 2024)

### Security & Performance Enhancements
1. **Rate Limiting**: All API routes now have rate limiting (60 requests/minute) to prevent abuse
2. **Input Sanitization**: All user inputs are validated and sanitized to prevent injection attacks
3. **Request Timeouts**: External API calls (Morpho, Dune) have configurable timeouts (30-60s)
4. **Error Handling**: Standardized error handling across all API routes with proper status codes
5. **Environment Validation**: Automatic validation of required environment variables on startup

### Code Quality Improvements
1. **Constants Extraction**: All magic numbers (chain IDs, timeouts, limits) moved to `/lib/constants.ts`
2. **Parallel API Calls**: Dune API calls are now parallelized for better performance
3. **Improved ErrorBoundary**: Enhanced error boundary with detailed error information in development
4. **Logging Service**: Centralized logging utility (ready for production logging service integration)
5. **Type Safety**: Improved TypeScript types throughout the codebase

### Infrastructure
1. **Allocation Intents Storage**: Documented in-memory storage limitation (ready for database migration)
2. **Cache Headers**: Added appropriate cache headers to API responses
3. **Code Organization**: Extracted large functions and improved code structure

## Previous Optimizations (Nov 2024)

### Critical Fixes
1. **🔴 Fixed Morpho Markets Query** - Added `chainId_in: [8453]` filter to prevent pulling markets from other chains (Ethereum, etc.). Previously, the query was fetching ALL chains which caused incorrect data display.

2. **Integrated Market Metrics** - Morpho risk ratings and liquidity metrics are now surfaced directly within each vault overview and detail page, consolidating market supply/borrow stats under their parent vault.

3. **Allocator Command Center** - New `/allocations` page aggregates V1 + V2 vaults, displays live market exposures, and captures allocation/deallocation intents for ops review.

4. **Improved Data Merging** - Vault market tables now intelligently merge:
   - Morpho market metrics (risk ratings 0-100, scores)
   - Supplied market data (allocations, rewards, utilization)
   - Proper error and loading state handling for both data sources

### Performance Improvements
- All GraphQL queries now explicitly filter by Base chainId (8453)
- Memoized expensive computations in markets page
- Optimized React Query stale times (5 minutes)
- **Removed legacy code**: Deleted old `/markets-supplied` page and 4 mock API routes
- Cleaned up unused components and legacy code
- Reduced route count from 16 to 12 (25% reduction)
- Parallelized Dune API calls for faster fee data fetching

### UI/UX Enhancements
- Consistent button styling across all pages (Fee Splitter matches other buttons)
- Proper badge colors for collateral/loan labels
- Green text for reward APR visibility
- Responsive grid layouts for mobile, tablet, and desktop
- Enhanced loading skeletons for better perceived performance
- Better error messages with Alert components

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

   **Note**: The `.env.example` file is blocked by gitignore. See the file structure below for required variables, or check the environment variable validation in `/lib/config/env.ts`.

   Required environment variables:
   - Server: `ALCHEMY_API_KEY` (required)
   - Client: `NEXT_PUBLIC_ALCHEMY_API_KEY` (required), `NEXT_PUBLIC_ONCHAINKIT_API_KEY` (optional)
   - Addresses:
     - V1: `NEXT_PUBLIC_VAULT_USDC`, `NEXT_PUBLIC_VAULT_CBBTC`, `NEXT_PUBLIC_VAULT_WETH`
     - V2 Prime: `NEXT_PUBLIC_VAULT_USDC_V2`, `NEXT_PUBLIC_VAULT_WETH_V2`, `NEXT_PUBLIC_VAULT_CBBTC_V2`
     - Fee splitter: `NEXT_PUBLIC_FEE_SPLITTER`
   - Optional: `NEXT_PUBLIC_DEFAULT_PERF_FEE_BPS`, `NEXT_PUBLIC_ROLE_OWNER`, `NEXT_PUBLIC_ROLE_GUARDIAN`, `NEXT_PUBLIC_ROLE_CURATOR`, `NEXT_PUBLIC_ALLOCATOR_HOT`, `NEXT_PUBLIC_ALLOCATOR_IGNAS`
   - Analytics: `DUNE_API_KEY` (optional, for Dune Analytics fee data integration)

   Environment variables are automatically validated on startup in development mode.

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
- Markets supplied: `/api/markets-supplied` discovers markets from allocations and fetches market stats and historical series
- Fee splitter: On-chain reads via viem from `NEXT_PUBLIC_FEE_SPLITTER`
- Fee analytics: Dune Analytics API (`/api/dune/fees`) for historical fee data and trends (requires `DUNE_API_KEY`)

References:
- Earn (vaults/allocations): https://docs.morpho.org/build/earn/tutorials/get-data
- Markets (markets/apy/history): https://docs.morpho.org/build/borrow/tutorials/get-data

## Project Structure

```
/app
  /page.tsx                 # Overview page
  /vaults/page.tsx         # All vaults list with market metrics per vault
  /vaults/[id]/page.tsx    # Vault detail page with embedded market metrics
  /allocations/page.tsx    # Allocate/deallocate interface for Morpho markets
  /fees/page.tsx           # Fees page
/api/markets-supplied    # Markets data endpoint (Morpho GraphQL)
/api/vaults              # Live vault list (Morpho GraphQL)
/api/vaults/[id]         # Live vault detail (Morpho GraphQL)
/api/protocol-stats      # Protocol aggregates (Morpho GraphQL)
/api/morpho-markets      # Morpho risk ratings (0-100 scale)
  /api/allocations/intents # Endpoint for recording allocation intents (in-memory storage, see notes below)
  /layout.tsx              # Root layout
  /providers.tsx           # App providers

/components
  KpiCard.tsx              # KPI display component
  VaultTable.tsx           # Vaults table
  ChartTvl.tsx             # TVL chart
  ChartFees.tsx            # Fees chart
  AddressBadge.tsx         # Address display with copy/scan
  RoleList.tsx             # Protocol roles
  AllocatorList.tsx        # Allocators list
  SplitterPanel.tsx        # Fee splitter panel

/lib
  /config/
    vaults.ts              # Vault configurations
    fee-splitters.ts       # Fee splitter contract mappings
    env.ts                 # Environment variable validation
  /constants.ts            # Application constants (chain IDs, timeouts, etc.)
  /utils/
    rate-limit.ts          # Rate limiting utilities
    error-handler.ts       # Standardized error handling
    sanitize.ts            # Input sanitization utilities
    fetch-with-timeout.ts  # Fetch with timeout wrapper
    logger.ts              # Logging service
  /onchain/
    client.ts              # Viem client setup
    contracts.ts           # Contract readers
  /hooks/                  # React Query hooks
  /format/number.ts        # Number formatting utilities
  /wallet/config.ts        # Wallet configuration
  /dune/service.ts         # Dune Analytics API service
```

## Deployment

Production checklist:
1. Set `.env` with production keys and addresses
2. `npm run build` succeeds
3. `npm start` runs and pages load without 500s
4. Verify wallet connect, fee splitter reads, and claim tx on test wallet
5. Monitor logs for Morpho API errors

## Development Notes

- Uses automatic Vercel deployments (no manual deployment needed)
- Vaults list/detail use Morpho API; fee splitter uses on-chain reads
- UI tolerates missing fields and renders N/A gracefully
- All components are responsive and accessible
- Charts load with skeleton states for better UX
- **Allocation Intents**: Currently stored in-memory (data lost on server restart). For production, migrate to a database (PostgreSQL, Supabase, etc.)
- **Rate Limiting**: In-memory rate limiting is used. For production at scale, consider using a distributed rate limiting service (e.g., Upstash)
- **Logging**: Development logging goes to console. For production, integrate with a logging service (Winston, Pino, Sentry, etc.)

## Contract Integration

### Vault Contracts
- Generic vault ABI with optional methods
- Resilient reads with try/catch patterns
- Fallback to default values for missing methods

### Fee Splitter Contract
- Immutable contract with fixed payees and shares
- Real-time pending token calculations
- Claim function enabled via wagmi `writeContract`

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
- `lastHarvest()`: Last harvest timestamp
- `pendingToken()`: Pending amounts for fee splitter

## Contributing

1. Follow TypeScript best practices
2. Use Tailwind CSS for styling
3. Implement proper error handling
4. Add loading states for better UX
5. Ensure responsive design
6. Test with both mock and on-chain data

## Contact

For questions or support, contact us at: **contact@muscadine.io**

## License

© 2024 Muscadine. Built on Base.