# Muscadine Curator

Next.js dashboard for Muscadine vaults on Morpho. Built on Base network.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env.local` file** with the following:
   ```bash
   # Required
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
   
   # Required (server-side - use one)
   ALCHEMY_API_KEY=your_alchemy_api_key
   # OR
   COINBASE_CDP_API_KEY=your_coinbase_cdp_api_key
   
   # Optional (client-side - can use same key as ALCHEMY_API_KEY)
   # If not set, wallet connections will use demo endpoints (rate limited)
   NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Open** http://localhost:3000

## Environment Variables

### Required

- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - Get from https://cloud.walletconnect.com
- `ALCHEMY_API_KEY` OR `COINBASE_CDP_API_KEY` - Server-side RPC (one required)

### Optional

- `NEXT_PUBLIC_ALCHEMY_API_KEY` - Client-side RPC for wallet connections (can use same value as `ALCHEMY_API_KEY`). If not set, uses demo endpoints.

### Optional

All other variables have defaults. See `.env.example` for full list.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run linter

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Wagmi + RainbowKit (wallet)
- Viem (blockchain)
- React Query (data fetching)

## License

© 2025 Muscadine. Built on Base.
