# Curator TODO

Running task list for agents and humans. Work **Today** top-to-bottom unless directed otherwise. **Later** is out of scope unless asked. Log finished work under **Done** and in `docs/brain/CHANGELOG.md`.

---

## Today

_(empty)_

---

## Later

- [ ] Email alerts when vault/market issues arise.
- [ ] Upgrade risk scoring (Liquidation Headroom, Utilization, Coverage Ratio, Oracle Freshness) — review params for V1/V2; Utilization + oracle freshness required.
- [ ] Public Safe App catalog listing — tech ready (`manifest.json` + CORS + Safe Apps SDK). Safe has paused new public listings; use Custom App in Safe{Wallet} with production `NEXT_PUBLIC_APP_URL` until listings reopen. Pre-assessment: https://forms.gle/PcDcaVx715LKrrQs8

---

## Done

- [x] 2026-07-27 — Deleted legacy `/morpho/create-market` + `/morpho/transact` pages (middleware redirects); fixed position URL load race, repay allowance buffer, vault Morpho app chain link.
- [x] 2026-07-27 — App IA refactor: top nav Overview/Vaults/Markets/Curator/Business; area sidebars; `/vaults` catalog + `/vaults/transact`; `/markets/create` + `/markets/positions`; legacy morpho routes redirect.
- [x] 2026-07-27 — Blue market position exit/manage on `/morpho/transact` (repay + withdraw collateral / supply); create-market keeps dead deposit + seed; Morpho Tools hub typography aligned; Muscadine realloc bot repos linked.
- [x] 2026-07-27 — Create-market follow-ups: dead deposit (1e9 shares → dEaD) + optional 90% util rate seed on same page after create; sidebar Morpho Tools → Markets → Multisig; denser vault nav.
- [x] 2026-07-27 — Allocation Rebalance edit boxes: seed/display-space amounts matching Allocated column; map to booked via `booked + (input − display)`; clear inputs on cancel / Safe queue; Min/Max write display-space.
- [x] 2026-07-27 — Morpho-style vault routes: `/vault/[address]/{allocation,caps,timelocks,sentinel,analytics}` + `/vaults/:chainId/:address/*` aliases.
- [x] 2026-07-27 — Safe App readiness audit: Curator Safe `0xb6d1…ED8b1` configured in `lib/safe/config.ts`; manifest + CORS already set; public catalog listing blocked externally → moved to Later.
- [x] 2026-07-27 — Overview/Analytics IA + USDC test vault + `/morpho/transact` (prior session).
