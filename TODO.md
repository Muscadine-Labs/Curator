# Curator TODO

Running task list for agents and humans. Work **Today** top-to-bottom unless directed otherwise. **Later** is out of scope unless asked. Log finished work under **Done** and in `docs/brain/CHANGELOG.md`.

## Today

## Later

- [ ] **Multichain support** — extend beyond Base-only RPC reads today:
  - Oracle panels (`MarketOraclePanel`) on Blue + Midnight detail for non-Base `chainId` (per-network RPC env + server client).
  - Market positions / bootstrap flows on chains where `getCreateMarketDeployment` is configured.
  - Risk scoring (`computeBlueMarketRiskScores`) when curator browses markets on Ethereum, Polygon, etc.
  - Midnight in-app positions (or keep external **Trade on Morpho** link only).
- [ ] Upgrade risk scoring (Liquidation Headroom, Utilization, Coverage Ratio, Oracle Freshness) — review params for V1/V2; Utilization + oracle freshness required. Look at top documentations like https://docs.kpk.io/vaults/
