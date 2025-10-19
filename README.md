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

   Required environment variables:
   - `ALCHEMY_API_KEY`: Your Alchemy API key for Base
   - `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`: WalletConnect project ID
   - `NEXT_PUBLIC_FEE_SPLITTER`: Fee splitter contract address
   - `USE_MOCK=1`: Enable mock mode for development

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

### Mock vs On-chain Mode

- **Mock Mode** (`USE_MOCK=1`): Uses mock API routes for development
- **On-chain Mode** (`USE_MOCK=0`): Reads data directly from contracts

Switch between modes by updating the `USE_MOCK` environment variable.

## Project Structure

```
/app
  /page.tsx                 # Overview page
  /vaults/page.tsx         # All vaults list
  /vaults/[id]/page.tsx    # Vault detail page
  /fees/page.tsx           # Fees page
  /api/mock/               # Mock API routes
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
- Mock API routes provide realistic data for development
- On-chain reads are resilient with fallbacks to mock data
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