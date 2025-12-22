# Muscadine Curator

Next.js dashboard for Muscadine vaults on Morpho. Data sourced from Morpho GraphQL API, DefiLlama, and on-chain reads. Wallet integration via Wagmi and Coinbase OnchainKit.

## Features

- Protocol overview dashboard with TVL, fees, revenue, and user metrics
- Interactive charts with toggleable views (total/by vault, daily/cumulative)
- Vault detail pages for V1 and V2 vaults
- Risk management analysis with hierarchical scoring
- Governance pages for roles, adapters, allocations, caps, and timelocks
- Dynamic vault categorization (V1, V2 Prime, V2 Vineyard)

## Tech Stack

- Framework: Next.js 15 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS + shadcn/ui
- State Management: React Query (TanStack)
- Wallet: Coinbase OnchainKit + wagmi + viem
- Blockchain: Base (Chain ID: 8453)
- RPC: Alchemy

## Network Configuration

All operations run on Base Network (Chain ID: 8453). Vault contracts, markets, and API queries are filtered to Base only. Wallet connections default to Base.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env.local`:
   - `NEXT_PUBLIC_ALCHEMY_API_KEY` (required)
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (required)
   - `COINBASE_CDP_API_KEY` or `ALCHEMY_API_KEY` (server-side, one required)
   - Vault addresses (optional - defaults provided)

3. Run development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

## Configuration

### Vaults

Vault addresses are configured in `/lib/config/vaults.ts`. Vaults are automatically categorized based on their names from GraphQL:
- Names containing "Prime" → V2 Prime Vaults
- Names containing "Vineyard" → V2 Vineyard Vaults
- All others → V1 Vaults

All metadata (name, symbol, asset, TVL, APY, performance fee) is fetched dynamically from GraphQL.

### Data Sources

- **Morpho GraphQL API**: Vault metadata, TVL, APY, allocations, positions, rewards
- **DefiLlama API**: Revenue and fees data
- **On-chain**: Protocol roles and contract reads

### API Endpoints

- `/api/vaults` - List all vaults
- `/api/vaults/[id]` - Vault detail
- `/api/vaults/v1/[id]/market-risk` - V1 vault risk analysis
- `/api/vaults/v2/[id]/risk` - V2 vault risk analysis
- `/api/vaults/v2/[id]/governance` - V2 vault governance data
- `/api/protocol-stats` - Protocol aggregates
- `/api/morpho-markets` - Market risk ratings

## Project Structure

```
/app
  page.tsx                  # Overview dashboard
  vault/v1/[address]/       # V1 vault detail pages
  vault/v2/[address]/       # V2 vault detail pages
  api/                      # API routes

/components
  layout/                   # App shell, sidebar, topbar
  morpho/                   # Vault-specific components
  ui/                       # shadcn/ui components

/lib
  config/                   # Vault configurations
  hooks/                    # React Query hooks
  morpho/                   # Morpho GraphQL client and utilities
  onchain/                  # Viem client and contract interfaces
  utils/                    # Utilities
```

## Deployment

Production requirements:

1. All tests passing (`npm test`)
2. Lint checks passing (`npm run lint`)
3. Build succeeds (`npm run build`)
4. Environment variables configured
5. Vault addresses verified in `/lib/config/vaults.ts`
6. Wallet integration tested on Base network

## Development

- Automatic Vercel deployments
- Rate limiting: In-memory (consider distributed solution for scale)
- Logging: Console (integrate service for production)
- Error handling: Graceful fallbacks for missing data

## License

© 2025 Muscadine. Built on Base.
