# Earnings and progression audit — 17 November 2026

Source: current GitHub main `83fee17bd4793ec5ae470445002d299caadceef2`.
Read-only testing; no live economy, reward odds, saves or player balances changed.

## Outcome

Nineteen deep audit groups passed. They include 11,040 independent income cases,
230 pending-delivery/reload/partition cases and 460 balance migration cases.
All 23 businesses and all five upgrade levels were covered. Existing economy
regressions and the isolated task-generator suite also pass their stated checks;
the latter still reports starter/full-stock design acceptance failures.

The independent income oracle integrates stocked intervals and boost overlap
without calling the production interval/gross functions. Tests additionally
extract actual game functions into a controlled harness for hiring, housing,
utilities, arrivals, restocking, vouchers, rushing, school effects, refunds,
stored-building restoration, reset boundaries, XP and BinLink payouts.

| Area | Observed result |
|---|---|
| Visible staffed stocked income | Full current rate, including visible idle play |
| Hidden/offline income | 50% while stock lasts; no automatic reorder |
| Staffing | Proportional business income; jobs remain fixed at L1–L5 |
| Existing hires | Retained when another business is added or the workplace closes |
| Housing disruption | Residents are retained in returning-resident storage and restored when capacity returns |
| Arrivals | Three residents per 15-second ledger tick; income begins after hiring |
| School | 1–5% at levels 1–5, fully staffed/connected, does not stack |
| Restock | Duplicate/early/stale-price orders rejected; one voucher pays one full order |
| Bakery reference | 20.2 coins/min fully staffed; 90-minute stock; 3-minute delivery; 24-coin fee |
| Rush | Dosh charged once for the tested pending order; replay has no effect |
| Demolition | 10% of recorded base coin purchase; no road/free park/Dosh-item coin refund |
| BinLink | 10/30 coins per ten visible service minutes; five of each yield 2,400 coins per 120 minutes |
| Operation XP | 6/min for first 120 active selling minutes; 1/min for next 120; no more thereafter |
| Development XP | 100/day; per-development receipts survive daily reset |
| Level 100 | 121,171 cumulative XP; every-fifth-level milestone gives 20 tickets to L100 |
| Balance migration | Stock fractions, pending timestamps and wallets preserved on repeat loads |
| Stored building | Identity, level, stock timestamp and purchase basis retained on restoration |

## Longer progression simulations

Four deterministic scenarios start from the **actual `newGame`: 8,000 coins and
zero residents**. Each attended scenario plays 120 minutes daily and is away for
the other 22 hours. Real live five-task rewards, weekly claims, operating XP,
restock XP, prices, housing, utilities, staffing and level grants are exercised.
The crate-opening scenario also opens the current live reward tables using a
seeded random sequence. Tickets remain banked; dice/wheel, missions and boosts
are not spent. A capital-spending strategy buys useful capacity and one copy of
each affordable/unlocked business; it is illustrative, not an optimal speedrun.

| Scenario | First reaches L100 | Important limit |
|---|---:|---|
| One bakery, attended, current daily rewards | Day 109 | No city growth; completes the current five-task fallback |
| Growing city, current daily rewards | Day 107 | Capital paid for; valid road access assumed |
| Growing city plus opening earned live crates | Day 105 | One deterministic reward seed; not a population estimate |
| Starter stocked once, then visible but untouched | Not by day 150 | Stops operation XP after the interaction grace window; stock is not automatically refilled |

The 105–109-day results support the 90–120-day target **under these live-rule
assumptions**. They do not validate future ten-task accessibility. Road geometry
and physical footprints are not simulated by this economic harness; connection
facts are supplied. Growth does include real affordability and infrastructure
capacity, rather than giving every business infinite workers or money. Values
in the JSON checkpoint logs are scenario outputs, not actual player accounts.

The simulations unlock low player levels quickly (about L10–11 on day one),
with much more XP needed later. All model unlock thresholds and high purchase
prices should therefore be judged separately from the L100 completion time.
One copy of each business is not a full island. A 105-day level curve does not
prove 105 days of new building content or a fixed time to fill the map.

## Findings that need follow-up

1. **Road XP is outside the development cap.** The real placement action grants
   one XP for every road construction. A controlled 250-place/demolish sequence
   granted 250 XP and cost 5,750 coins (23/XP); road demolition refunded nothing.
   This is a paid repeatable XP path. Consider moving road XP into the daily
   development budget or a first-placement receipt rule, preserving normal road
   building. No fix was made and no ordinary-play exploit speed is claimed.

2. **Settle time before economic mutations.** Directly upgrading a bakery before
   settling its previous hour paid 1,512 rather than 1,212 coins, because the new
   rate was used retroactively. Normal trusted pointerdown/keydown calls settle
   first. This is an integration boundary risk, not proof normal taps overpay.
   Audit alternate handlers, boost activation, restore and automation paths, and
   make settlement an explicit invariant at the mutation boundary.

3. **Correct starter data.** The earlier task fixture used the 3,000-coin
   `baseState`; actual `newGame` overrides it to 8,000 coins and zero population.
   The empty-city ten-goal failure remains, but foundation affordability needs
   the real starting balance. The current Delivery Depot catalogue quote is
   100 coins although some older design notes call it free. Reconcile that
   discrepancy before treating the notes as live facts.

4. **Keep legacy boost normalization away from the new 10-minute reward.** The
   current normalizer converts stored duration to 15-minute tokens, rounding up:
   the tested 65 stored minutes became 75, while active expiry stayed unchanged.
   The new 10-minute reward release must deliberately preserve old minutes and
   accept the new token duration. Otherwise a future reload could change it.

5. **Whole reward supply is still not reconciled.** The live level callback
   awards direct old crates, every five levels awards tickets/deeds, and the
   weekly commission awards three tickets. Live spins, openings, missions,
   purchases and roads also award XP. Do not assume 720+220+100+200 is the entire
   progression model or add task tickets on top of a duplicate playtime grant.

6. **Task eligibility is a release gate.** The future ten-task generator is not
   ready for all cities. Do not promise weekly guaranteed purchasing power
   before its smaller/foundation fallback is approved and tested.

## Reward-only arithmetic, separate from live tests

`reward-supply-audit.cjs` checks the approved future tables. Wheel voucher EV is
0.9 random plus 0.2 long-run milestone per spin. Expected weekly throughput must
also include crate→spin→voucher feedback, not only direct sources. Its JSON
reports the range for each spending tier, seven/fourteen free weekly spins and
retaining/removing the legacy three-ticket grant. Free shop assumptions are
explicit; level tickets are excluded because level gains vary.

No revised crate odds, market fee, level reward or shop price is approved by the
act of testing it. Proposed retirements of legacy grants need review as part of
the coordinated release.

## Reproduce

Run from repository root:

```powershell
node tests/economy-balance.cjs
node tests/economy-scenarios.cjs
node tests/daily-tasks.cjs
node tests/economy-deep-audit.cjs
node tests/economy-progression-audit.cjs
node tests/reward-supply-audit.cjs
```

Detailed reproducible outputs are `economy-deep-audit-results.json`,
`economy-progression-audit-results.json` and `reward-supply-audit-results.json`
in this directory. Prototype/plan files are on the review branch only. Signed-in
iPhone home-screen saves, a real two-device cloud race, and production item
ownership transactions still need direct supported-device/backend tests.
