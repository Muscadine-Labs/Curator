# API Documentation

## Overview

The Muscadine Curator Interface provides RESTful API endpoints for accessing vault data, protocol statistics, and market information. All endpoints return JSON responses.

## Base URL

- Development: `http://localhost:3000`
- Production: `https://your-domain.com`

## Rate Limiting

All API endpoints are rate-limited:
- **Limit**: 60 requests per minute per IP address
- **Headers**: Rate limit information is included in response headers:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Unix timestamp when the rate limit resets

When rate limited, endpoints return `429 Too Many Requests`.

## Error Responses

All errors follow a standardized format:

```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "statusCode": 400,
    "details": {}
  }
}
```

## Endpoints

### GET /api/vaults

Get a list of all configured vaults with their current state.

**Response:**
```json
[
  {
    "id": "usdc-vault",
    "name": "Muscadine USDC Vault",
    "address": "0x...",
    "tvl": 10000000,
    "apy7d": 5.2,
    "apy30d": 5.5,
    "depositors": 150
  }
]
```

**Cache**: 60 seconds

---

### GET /api/vaults/[id]

Get detailed information about a specific vault.

**Parameters:**
- `id` (path): Vault ID or address

**Response:**
```json
{
  "address": "0x...",
  "name": "Muscadine USDC Vault",
  "tvl": 10000000,
  "apy": 5.2,
  "allocations": [...],
  "positions": [...],
  "transactions": [...]
}
```

**Cache**: 60 seconds

---

### GET /api/protocol-stats

Get aggregated protocol statistics.

**Response:**
```json
{
  "totalDeposited": 50000000,
  "totalUsers": 500,
  "totalFeesGenerated": 100000,
  "tvlTrend": [...],
  "feesTrend": [...]
}
```

**Cache**: 60 seconds

---

### GET /api/markets-supplied

Get markets that vaults are supplying to, with allocation details.

**Response:**
```json
{
  "markets": [...],
  "vaultAllocations": [...],
  "availableMarkets": [...]
}
```

**Cache**: 60 seconds

---

### GET /api/morpho-markets

Get Morpho market ratings and risk scores.

**Query Parameters:**
- `limit` (optional): Maximum number of markets to return (default: 200, max: 1000)
- `marketId` (optional): Filter by specific market ID

**Response:**
```json
{
  "timestamp": "2024-12-01T00:00:00Z",
  "markets": [
    {
      "uniqueKey": "...",
      "rating": 85,
      "scores": {...}
    }
  ]
}
```

**Cache**: 300 seconds

---

### GET /api/dune/fees

Get fee data from Dune Analytics.

**Query Parameters:**
- `vaults` (optional): Comma-separated list of vault addresses

**Response:**
```json
{
  "totalFeesGenerated": 100000,
  "feeHistory": [...],
  "feesTrend": [...],
  "performanceFeeBps": 200
}
```

**Cache**: 300 seconds

**Note**: Requires `DUNE_API_KEY` environment variable. Returns error if not configured.

---

### GET /api/allocations/intents

Get allocation intents (in-memory storage).

**Response:**
```json
{
  "intents": [
    {
      "id": "...",
      "vaultAddress": "0x...",
      "marketKey": "...",
      "action": "allocate",
      "amountUsd": 10000,
      "createdAt": "2024-12-01T00:00:00Z"
    }
  ],
  "note": "This is in-memory storage. Data will be lost on server restart."
}
```

**Cache**: 10 seconds

---

### POST /api/allocations/intents

Create a new allocation intent.

**Request Body:**
```json
{
  "vaultAddress": "0x...",
  "marketKey": "...",
  "action": "allocate",
  "amountUsd": 10000,
  "sharePct": 10,
  "walletAddress": "0x...",
  "notes": "Optional notes"
}
```

**Response:**
```json
{
  "intent": {
    "id": "...",
    "vaultAddress": "0x...",
    "marketKey": "...",
    "action": "allocate",
    "amountUsd": 10000,
    "createdAt": "2024-12-01T00:00:00Z"
  }
}
```

**Status Codes:**
- `201`: Created successfully
- `400`: Invalid input
- `429`: Rate limited

**Validation:**
- `vaultAddress`: Required, must be valid Ethereum address
- `marketKey`: Required, string
- `action`: Required, must be "allocate" or "deallocate"
- `amountUsd`: Optional, number >= 0
- `sharePct`: Optional, number between 0-100
- `walletAddress`: Optional, valid Ethereum address
- `notes`: Optional, string (max 5000 chars)

---

## Authentication

Currently, no authentication is required. All endpoints are publicly accessible. Consider adding authentication for production use.

## CORS

CORS headers are not explicitly configured. For cross-origin requests, configure CORS in `next.config.ts` or middleware.

## Timeouts

- Internal API requests: 30 seconds
- External API requests (Morpho, Dune): 60 seconds

## Best Practices

1. **Caching**: Respect cache headers and implement client-side caching
2. **Rate Limiting**: Implement exponential backoff when rate limited
3. **Error Handling**: Always check response status and handle errors gracefully
4. **Pagination**: Some endpoints may return large datasets; consider pagination for production

## Support

For API issues or questions, contact: **contact@muscadine.io**

