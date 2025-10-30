# Muscadine Curator

Modern Next.js dashboard for Muscadine vaults on Morpho. Live data is sourced from the Morpho GraphQL API and onchain reads; wallet connection and fee-claim actions are powered by Wagmi + Coinbase OnchainKit.

## Features

- **Protocol Overview**: KPI dashboard with TVL, fees, and user metrics
- **Vault Explorer**: Comprehensive list of all Muscadine vaults with filtering and search
- **Vault Details**: Individual vault pages with performance charts and role information
- **Fee Splitter**: Integration with immutable ERC20FeeSplitter contract
- **Wallet Integration**: Coinbase OnchainKit + wagmi + viem
- **On-chain Data**: Real-time data from Base chain via Alchemy
- **Mock Mode**: Development mode with mock API routes

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **State Management**: React Query (TanStack)
- **Wallet**: Coinbase OnchainKit + wagmi + viem
- **Blockchain**: Base (Chain ID: 8453)
- **RPC**: Alchemy

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
  /vaults/page.tsx         # All vaults list
  /vaults/[id]/page.tsx    # Vault detail page
  /fees/page.tsx           # Fees page
  /markets-supplied/page.tsx # Markets we supply to
/api/mock/               # Mock API routes (legacy; vault list/detail use live endpoints)
/api/vaults              # Live vault list (Morpho GraphQL)
/api/vaults/[id]         # Live vault detail (Morpho GraphQL)
 /api/protocol-stats      # Protocol aggregates (Morpho GraphQL)
 /api/markets-supplied    # Aggregated supplied markets + history
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