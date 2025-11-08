# Muscadine Curator

Modern Next.js dashboard for Muscadine vaults on Morpho. Live data is sourced from the Morpho GraphQL API and onchain reads; wallet connection and fee-claim actions are powered by Wagmi + Coinbase OnchainKit.

## Features

- **Protocol Overview**: KPI dashboard with TVL, total interest generated, and user metrics
- **Vaults Explorer**: Comprehensive view of all 3 Muscadine vaults with their market allocations and curator risk ratings (0-100)
- **Vault Details**: Individual vault pages with performance charts and role information
- **Fee Splitter**: Integration with immutable ERC20FeeSplitter contract for fee claims
- **Wallet Integration**: Coinbase OnchainKit + wagmi + viem for Base network
- **On-chain Data**: Real-time data from Base chain via Alchemy and Morpho GraphQL API

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

## Recent Optimizations (Nov 2024)

### Critical Fixes
1. **🔴 Fixed Morpho Markets Query** - Added `chainId_in: [8453]` filter to prevent pulling markets from other chains (Ethereum, etc.). Previously, the query was fetching ALL chains which caused incorrect data display.

2. **Integrated Market Metrics** - Morpho risk ratings and liquidity metrics are now surfaced directly within each vault overview and detail page, consolidating market supply/borrow stats under their parent vault.

3. **Improved Data Merging** - Vault market tables now intelligently merge:
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

   Required environment variables:
   - Server: `ALCHEMY_API_KEY`
   - Client: `NEXT_PUBLIC_ALCHEMY_API_KEY`, `NEXT_PUBLIC_ONCHAINKIT_API_KEY`
   - Addresses: `NEXT_PUBLIC_VAULT_USDC`, `NEXT_PUBLIC_VAULT_CBBTC`, `NEXT_PUBLIC_VAULT_WETH`, `NEXT_PUBLIC_FEE_SPLITTER`
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

- Vault list: Morpho GraphQL (`/api/vaults`) maps TVL and APY fields per Morpho docs
- Vault detail: Morpho GraphQL (`/api/vaults/[id]`) via `vaultByAddress` + positions + allocations + rewards + warnings + queues + txs
- Protocol overview: `/api/protocol-stats` aggregates TVL/users across configured vaults
- Markets supplied: `/api/markets-supplied` discovers markets from allocations and fetches market stats and historical series
- Fee splitter: On-chain reads via viem from `NEXT_PUBLIC_FEE_SPLITTER`

References:
- Earn (vaults/allocations): https://docs.morpho.org/build/earn/tutorials/get-data
- Markets (markets/apy/history): https://docs.morpho.org/build/borrow/tutorials/get-data

## Project Structure

```
/app
  /page.tsx                 # Overview page
  /vaults/page.tsx         # All vaults list with market metrics per vault
  /vaults/[id]/page.tsx    # Vault detail page with embedded market metrics
  /fees/page.tsx           # Fees page
/api/markets-supplied    # Markets data endpoint (Morpho GraphQL)
/api/vaults              # Live vault list (Morpho GraphQL)
/api/vaults/[id]         # Live vault detail (Morpho GraphQL)
/api/protocol-stats      # Protocol aggregates (Morpho GraphQL)
/api/morpho-markets      # Morpho risk ratings (0-100 scale)
  /layout.tsx              # Root layout
  /providers.tsx           # App providers

/components
  KpiCard.tsx              # KPI display component
  VaultTable.tsx           # Vaults table
  ChartTvl.tsx             # TVL chart
  ChartFees.tsx            # Fees chart
  ChartPerf.tsx            # Performance chart
  AddressBadge.tsx         # Address display with copy/scan
  RoleList.tsx             # Protocol roles
  AllocatorList.tsx        # Allocators list
  SplitterPanel.tsx        # Fee splitter panel

/lib
  /config/vaults.ts        # Vault configurations
  /onchain/client.ts       # Viem client setup
  /onchain/contracts.ts    # Contract readers
  /hooks/                  # React Query hooks
  /format/number.ts        # Number formatting utilities
  /wallet/config.ts        # Wallet configuration
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