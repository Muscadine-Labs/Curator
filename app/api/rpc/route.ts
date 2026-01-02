import { NextResponse } from 'next/server';

// Vercel runtime configuration
export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * API route to get RPC URLs without exposing API keys to the client
 * Returns the RPC URL for the requested chain
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get('chainId');
    
    if (!chainId) {
      return NextResponse.json(
        { error: 'chainId parameter is required' },
        { status: 400 }
      );
    }

    const chainIdNum = parseInt(chainId, 10);
    if (isNaN(chainIdNum)) {
      return NextResponse.json(
        { error: 'Invalid chainId' },
        { status: 400 }
      );
    }

    // Get RPC URL using server-side environment variables
    let rpcUrl: string;
    
    if (process.env.ALCHEMY_API_KEY) {
      // Use Alchemy if available
      switch (chainIdNum) {
        case 8453: // Base
          rpcUrl = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
          break;
        case 1: // Ethereum Mainnet
          rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
          break;
        case 10: // Optimism
          rpcUrl = `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
          break;
        case 137: // Polygon
          rpcUrl = `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
          break;
        default:
          rpcUrl = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
      }
    } else if (process.env.COINBASE_CDP_API_KEY) {
      // Fallback to Coinbase CDP
      rpcUrl = `https://base-mainnet.cdp.coinbase.com/v1/${process.env.COINBASE_CDP_API_KEY}`;
    } else {
      // Demo fallback
      switch (chainIdNum) {
        case 8453: // Base
          rpcUrl = 'https://base-mainnet.g.alchemy.com/v2/demo';
          break;
        case 1: // Ethereum Mainnet
          rpcUrl = 'https://eth-mainnet.g.alchemy.com/v2/demo';
          break;
        case 10: // Optimism
          rpcUrl = 'https://opt-mainnet.g.alchemy.com/v2/demo';
          break;
        case 137: // Polygon
          rpcUrl = 'https://polygon-mainnet.g.alchemy.com/v2/demo';
          break;
        default:
          rpcUrl = 'https://base-mainnet.g.alchemy.com/v2/demo';
      }
    }

    return NextResponse.json({ rpcUrl }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get RPC URL' },
      { status: 500 }
    );
  }
}

