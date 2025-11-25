# On-Chain Sourcing Opportunities

This document identifies hardcoded values in the repository that could be sourced from on-chain contracts instead.

## ✅ Fixed

### 1. Performance Fee (performanceFeeBps)
- **Status**: ✅ **FIXED** - Now fetches from contract with config fallback
- **Location**: `app/api/vaults/[id]/route.ts`
- **Previous**: Hardcoded `DEFAULT_PERFORMANCE_FEE_BPS` (200 bps) from config
- **Now**: Fetches on-chain using `readVaultData()` with config as fallback
- **Impact**: Vault detail page now shows actual contract fee rate

## 🔍 Identified (Not Yet Fixed)

### 2. Performance Fee in Dune Fees Route
- **Location**: `app/api/dune/fees/route.ts` (line 192)
- **Current**: Uses `DEFAULT_PERFORMANCE_FEE_BPS` hardcoded value
- **Opportunity**: Could fetch from vault contracts (may need to aggregate if multiple vaults)
- **Note**: This route returns a single `performanceFeeBps` for all vaults, so aggregation logic would be needed

### 3. Total Fees Generated
- **Location**: `app/api/protocol-stats/route.ts`, `app/api/dune/fees/route.ts`
- **Current**: 
  - Fetched from Morpho API (`v.state?.fee`)
  - Or from Dune Analytics API
- **Opportunity**: Could be calculated on-chain by:
  - Reading `Harvest` or `FeesCollected` events from vault contracts
  - Summing historical fee collection events
  - More accurate but requires event indexing infrastructure

### 4. Vault Roles (Owner, Curator, Guardian, Timelock)
- **Location**: `app/api/vaults/[id]/route.ts`
- **Current**: Fetched from Morpho GraphQL API
- **Opportunity**: Could be read directly from vault contracts if they expose these as view functions
- **Note**: Already sourced from API, but could be more direct from contracts

### 5. Allocator Addresses
- **Location**: `lib/config/vaults.ts` (protocolConfig.roles.allocators)
- **Current**: Hardcoded in config
- **Opportunity**: Could be read from vault contract's allocator registry (if available)
- **Note**: May require contract ABI updates to expose allocator list

### 6. Fee Splitter Addresses
- **Location**: `lib/config/fee-splitters.ts`
- **Current**: Hardcoded mappings
- **Opportunity**: Could be read from vault contract if it exposes fee splitter address
- **Note**: May require contract ABI updates

## Recommendations

### High Priority
1. ✅ **Performance Fee** - Already fixed in vault detail route
2. **Performance Fee in Dune Route** - Consider fetching from vaults or removing if not needed

### Medium Priority
3. **Total Fees** - Consider on-chain event indexing for more accurate historical data
4. **Vault Roles** - Could be read directly from contracts if ABI supports it

### Low Priority
5. **Allocator Addresses** - Only needed if contract exposes allocator registry
6. **Fee Splitter Addresses** - Only needed if contract exposes fee splitter address

## Implementation Notes

- The `readVaultData()` function in `lib/onchain/contracts.ts` already supports reading `performanceFeeBps` from contracts
- On-chain reads may be slower than config lookups, so caching is recommended
- Fallback to config values ensures the API doesn't fail if contract reads timeout
- Consider adding error handling and retry logic for on-chain reads

