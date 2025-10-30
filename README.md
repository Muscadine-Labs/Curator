# Muscadine Curator

A vault explorer for Muscadine protocol, similar to curator.morpho.org/vaults. Built with Next.js 14, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

- **Protocol Overview**: KPI dashboard with TVL, fees, and user metrics
- **Vault Explorer**: Comprehensive list of all Muscadine vaults with filtering and search
- **Vault Details**: Individual vault pages with performance charts and role information
- **Fee Splitter**: Integration with immutable ERC20FeeSplitter contract
- **Wallet Integration**: Reown (WalletConnect) integration with wagmi + viem
- **On-chain Data**: Real-time data from Base chain via Alchemy
- **Mock Mode**: Development mode with mock API routes

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **State Management**: React Query (TanStack)
- **Wallet**: Reown (WalletConnect) + wagmi + viem
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

   Required environment variables (public addresses included for clarity):
   - `NEXT_PUBLIC_CHAIN_ID` (Base = 8453)
   - `NEXT_PUBLIC_MORPHO_GRAPHQL` (default `https://api.morpho.org/graphql`)
   - `NEXT_PUBLIC_VAULT_USDC` (vault address)
   - `NEXT_PUBLIC_VAULT_CBBTC` (vault address)
   - `NEXT_PUBLIC_VAULT_WETH` (vault address)
   - `NEXT_PUBLIC_FEE_SPLITTER` (fee splitter contract address)
   - Optional: `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`, `ALCHEMY_API_KEY`

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
- Vault detail: Morpho GraphQL (`/api/vaults/[id]`) via `vaultByAddress` + positions
- Fee splitter: On-chain reads via viem from `NEXT_PUBLIC_FEE_SPLITTER`

Reference: `https://docs.morpho.org/build/earn/tutorials/get-data`

## Project Structure

```
/app
  /page.tsx                 # Overview page
  /vaults/page.tsx         # All vaults list
  /vaults/[id]/page.tsx    # Vault detail page
  /fees/page.tsx           # Fees page
/api/mock/               # Mock API routes (legacy; vault list/detail use live endpoints)
/api/vaults              # Live vault list (Morpho GraphQL)
/api/vaults/[id]         # Live vault detail (Morpho GraphQL)
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

The project is configured for automatic Vercel deployments:

1. **DNS**: Point `curator.muscadine.io` to Vercel CNAME `cname.vercel-dns.com`
2. **Environment**: Set environment variables in Vercel dashboard
3. **Deploy**: Push to main branch triggers automatic deployment

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
- Disabled claim functions (coming soon)

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