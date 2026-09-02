# Curator TODO

Running task list for agents and humans. Work **Today** top-to-bottom unless directed otherwise. **Later** is out of scope unless asked. Log finished work under **Done** and in `docs/brain/CHANGELOG.md`.

## Today

## Done
- #1 Markets browse: Loan / Collateral / Search also filter Midnight (pair tokens, order-independent) via `lib/morpho/market-pair-filter.ts`.
- #2 `/markets/positions` MAX on every amount field (Muscadine app UX). Wallet ERC-20 for supply/add collateral; LLTV-buffered borrow; min(wallet, debt) repay (full → shares); max-safe collateral withdraw; full supply exit by shares. Morpho earn/borrow assets-flow.
- #3 `/vaults/transact` + `/markets/positions` review modal (`TxPreviewDialog` + `buildUserTxPreview`) before wallet sign; stays open through confirm.
- #4 Vault `/allocation` column headers cycle sort: high→low, low→high, default (`cycleAllocationHeaderSort`).
- Review: pair prefix matching (`ETH` ≠ `WETH`); full-repay MAX no longer needs a 1% extra balance; stale load ignored; Next 16.3.4 / lucide 1.39 / viem 2.56.3.
- Review (subagents): stale `loadMarket` catch/finally; preview confirm lock; full repay only when wallet covers debt; bigint near-full exit.

## Later

- [ ] **Multichain support** — extend beyond Base-only RPC reads today:
  - Oracle panels (`MarketOraclePanel`) on Blue + Midnight detail for non-Base `chainId` (per-network RPC env + server client).
  - Market positions / bootstrap flows on chains where `getCreateMarketDeployment` is configured.
  - Risk scoring (`computeBlueMarketRiskScores`) when curator browses markets on Ethereum, Polygon, etc.
  - Midnight in-app positions (or keep external **Trade on Morpho** link only).
- [ ] Upgrade risk scoring (Liquidation Headroom, Utilization, Coverage Ratio, Oracle Freshness) — review params for V1/V2; Utilization + oracle freshness required. Look at top documentations like https://docs.kpk.io/vaults/
