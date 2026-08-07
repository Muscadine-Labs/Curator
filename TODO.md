# Curator TODO

Running task list for agents and humans. Work **Today** top-to-bottom unless directed otherwise. **Later** is out of scope unless asked. Log finished work under **Done** and in `docs/brain/CHANGELOG.md`.

---

## Today

- new features like /curator/bots load really slowly, same with on overview on users for users and transactions load slowly, is there a bug or is that just how long it loads?
- on curator/bots, keep default only on for the allocator safe and sentinel safe, the other two are EOAs, should stay toggle off. Add another bot called Rebater, as of now it has not been created yet, but it is when funds move out of the treasury safe, so you can log those from grapgh ql id transactions leave. Also, on the bot page, make it so its tabbed, with three tabs for the three bots so i can easily go to each one, all on one page makes it hard to view the others. You can be the three tab on top of "Allocate / deallocate and roles come from Morpho GraphQL. Liquidity adapter, cap decreases, revoke pending, and remove-allocator are decoded from calldata when GraphQL has no row." Lastly,
- add this bot https://t.me/MuscadineVaultBot to our bots, its a telegram bot that gets updates from our three bots 

---

## Later

- [ ] on /markets support now morpho midnight though graph ql when it is supported. Have a toggle between All, midnight and Blue. Review how midnight works to successfully implement it, such as "Network, Loan, Collateral, LLTV, Oracle, Maturity, Active loans, Borrow depth, Lend depth, Best rate"

- [ ] Upgrade risk scoring (Liquidation Headroom, Utilization, Coverage Ratio, Oracle Freshness) — review params for V1/V2; Utilization + oracle freshness required. Look at top documentations like https://docs.kpk.io/vaults/

---

## Done
