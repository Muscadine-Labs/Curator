# Curator TODO

Running task list for agents and humans. Work **Today** top-to-bottom unless directed otherwise. **Later** is out of scope unless asked. Log finished work under **Done** and in `docs/brain/CHANGELOG.md`.

## Today

- [ ] AI review all repo files find any bugs, update dependencies that can be updated (wagmi, typescript and eslint have certain limitations, also https://github.com/Muscadine-Labs/curator/security/dependabot)

## Later

- [ ] Upgrade risk scoring (Liquidation Headroom, Utilization, Coverage Ratio, Oracle Freshness) — review params for V1/V2; Utilization + oracle freshness required. Look at top documentations like https://docs.kpk.io/vaults/

---

## Done

- `/vaults` Morpho-style table (Prime / Frontier / Vineyard / Test). Vault tabs Overview → Allocation → Caps → Risk. Caps grouped tables + Public Allocator view when PA is an allocator.

- Bots: no **Bot** label on `0xf35B…B333`; bots execute via Allocator/Sentinel Safes.
- Curator tools hub is `/curator` (was `/morpho`); bots at `/curator/bots`.
- Removed Morpho-org/vault-v2-reallocation-bot from `/curator` Automation bots.
- Bots + overview users/txs slowness: not a hang. Bots was N GraphQL APY queries per tx + Alchemy for every role holder; now one APY series per vault, Alchemy only for known bot/Safes, and each tab fetches its own panel. Protocol txs is one GraphQL query instead of one per vault. First click is still Morpho-latency bound (~seconds on a cold 30s cache).
- `/morpho/bots`: Allocator / Sentinel / Rebater tabs; Allocator Safe + Sentinel Safe on by default, bot EOAs off; Rebater logs treasury Safe outflows from GraphQL (bot not deployed yet). Telegram [@MuscadineVaultBot](https://t.me/MuscadineVaultBot) + [muscadine-bots](https://github.com/Muscadine-Labs/muscadine-bots).
- Review findings: session cookie on BFFs, treasury share-Δ minus self-deposits, vault list cache/batch, UTC dates, no Alchemy `/demo`.
- Treasury income: GraphQL daily **share** change × that day's USD; self-deposits subtracted; no RPC/ABI; HTTP session cookie on BFFs.
- Midnight detail pages at `/midnight/[id]` (order book, not Blue). Morpho Markets link is `https://markets.morpho.org/fixed/{chain}/{id}`.
- `/markets`: All / Blue / Midnight toggle. Midnight via REST books API (GraphQL is Blue-only). Wallet supply/borrow strip with Manage → `/markets/positions`.
