# Daily task generator checkpoint - 17 November 2026

Baseline: GitHub main `83fee17bd4793ec5ae470445002d299caadceef2`.
Status: isolated prototype; **not ready for release**. No HTML, live reward system,
player save, compensation, migration, shop or page design is changed.

## Findings

| Controlled profile | Ten-goal acceptance | Completion in simulated attended play |
|---|---|---|
| One staffed bakery, no BinLink, supplied home, 30 minutes of current stock | Blocked | Cannot fill ten distinct meaningful goals |
| Brand-new city, 3,000 starting coins, no placed buildings | Blocked | Needs foundation setup before operating goals exist |
| Five staffed businesses, 30 minutes of stock, connected BinLink | Pass for the tested seed | 95 minutes |
| All 23 businesses fully stocked at level one, connected BinLink | Blocked on initial assignment | No genuinely needed order within the 75-minute eligibility window |
| Same five-business city without BinLink | Pass for the tested seed | 95 minutes |

These are constructed derive-state fixtures with existing housing/utilities and
fixed staffing where specified. They are not player cities or iPhone tests.
The growing portfolios are bakery, coffee, workshop, books and grocery. Fixture
wallets are deliberately ample (100,000 coins); this does not assert that an early
player actually owns that capital. `snapshot` reads rates, categories, durations,
fees and staffing from the actual pinned game definitions and economy core.

For a one-business city, the sale/stock/trading variants collapse onto one
selling counter/scope. An order and its delivery should not be separate goals on
the same order. Together with at most two duration-maintenance goals, that leaves
four materially distinct operations. One genuinely useful affordable improvement
could add one goal; it still does not produce ten. Having 66 eligible template
instances does not mean having 66 distinct activities.

For a full-stock established city with no current improvement need, the family
ceilings give at most eight: one direct sales target, two trading goals, two stock
goals, one BinLink visit/fare objective and two maintenance goals. The first
90/120/180/240-minute batches all exceed the 75-minute needed-order window.
The prototype correctly refuses to invent early restocking or a useless purchase.
Diagnostic partial selections are previews, not playable sets or maximum-size
proofs; the upper bound and search-budget flag are reported separately.

## Concrete starter fallback for review

Recommended design change: **adaptive operations sets with the same full daily
reward budget**, rather than forcing ten nominal tasks onto four activities.
This is a proposal, not an approved replacement for the ten-task specification.

For an operating one-bakery city, a curated four-goal example is:

1. Keep an existing occupied home supplied for 15 active minutes.
2. Maintain the bakery's frozen staffing level for 35 active minutes.
3. Order its one genuinely needed full restock (coins or an existing voucher).
4. Accumulate 90 new selling minutes at the bakery, including its normal delivery
   interruption. With 30 minutes of initial stock and a three-minute delivery,
   that is 93 minutes of attended play.

This uses distinct scope/counters, two maintenance goals and no forced purchase,
menu tapping, dosh, full-batch depletion or repeated ordering. Select an existing
useful improvement only when one is actually needed and affordable; it is not a
prerequisite for receiving the daily budget.

An exact budget-preserving example for these four goals is base rewards of
2/2/3/3 crate vouchers and dosh, and 20/40/60/80 XP. Put the existing halfway
milestone at two claims and the final milestone at four claims. The unchanged
milestone rewards then produce 14 vouchers, 12 dosh, two restock vouchers, two
wheel tickets and 220 XP. This explicitly changes per-task rewards, difficulty
counts and milestone thresholds, so it is **not enabled in the code**.

A full-stock established fallback could similarly use eight distinct operations
and retain the same daily aggregate, avoiding punishment for staying stocked.
Actual allocation and replacement eligibility still need testing after choosing
the adaptive-set design. Another option is adding real new activities, but those
mechanics are deferred and cannot be silently counted as available today.

For a genuinely blank city, use a separate foundation path to establish Town
Hall, a needed home, services, an affordable operating business and its staffing.
Do not freeze an impossible daily set before those capabilities exist. Exact
foundation costs, layout accessibility and handover timing require a separate
onboarding simulation. No foundation reward or mid-day extra set is introduced
by this prototype.

## Implemented in isolation

- Forty identified candidate variants across the drafted ten families, with
  frozen instance IDs, scopes, quantities, resource plans and completion estimates.
- Seeded 3/4/3 selection; same saved set on reload; previous-template preference;
  family, money, improvement, maintenance, order and cross-family deduplication.
- Conservative stock and delivery timing, combined fee/voucher affordability and
  optional improvement reserves. Selling across a group budgets all possible
  delivery interruptions. No projected coins are needed to justify an order.
- One free unclaimed same-difficulty replacement; fresh progress starts at the
  replacement timestamp; saved use survives reload; no valid substitute leaves
  the allowance unused.
- Pure event reducer for active foreground progress, new sales, distinct orders,
  deliveries and bus visits. Duplicate events, overlapping intervals and events
  preceding assignment are rejected. Deliveries can count while away; duration
  and sales progress cannot. Actual bus visits support either visits or fares.
- Claim and milestone receipts with a record revision conflict protocol. Reward
  state and ledger are returned together for a future canonical transaction.
  Replaying a claim does not pay twice in the protocol tests.

The forty candidates are an executable first translation of the draft, not a
claim of final content approval. Stock fractions use conservative selling-time
equivalents and duration targets use 15/35/90 minutes. The conservative rank gates
reject standard goals estimated below 25 minutes and challenging goals below 60.
Those choices deliberately expose gaps instead of labelling trivial goals hard.
Player-facing copy currently identifies metrics, exact quantities and instance
IDs; names and wording belong to the later UI pass.

## Tests and limits

Run `node tests/daily-tasks.cjs`, `node tests/economy-balance.cjs` and
`node tests/economy-scenarios.cjs` from the repository root. The daily test writes
`docs/daily-task-scenarios.json` with reproducible detailed assignments/results.

The daily test covers five profiles, 345 business/level/stock combinations,
deterministic assignments, Brisbane reset, frozen targets, fourteen replacement
days, no BinLink without owned stops, pending delivery eligibility, zero-wallet
orders, actual economy settlement into progress, one-time claims, stale revision
conflicts, milestones and weekly reward arithmetic. A separate synthetic
ten-task claim fixture tests the payout protocol; it is explicitly not evidence
that a starter city can receive ten sensible tasks.

Accepted generated sets are exercised for 120 attended minutes using the actual
`LabCore.settle`, rates and fees. The driver orders only empty stock, emits the
resulting deliveries and visit events and claims only achieved tasks. It does
not fill progress counters directly to pass the generated-set test.

Seven-session fixed-portfolio checks use different deterministic seeds, one
initial profile day and empty stock after each overnight absence. The growing
and no-BinLink portfolios completed all seven sets and earned 98 task vouchers.
The initially full-stock late portfolio completed six later sets and earned 84;
its first day was blocked. Starter and blank portfolios were blocked throughout.
These are release-blocking gaps, **not a recommendation to pay those cities zero**.
The simulation keeps level-one portfolios and an ample initial wallet fixed;
it is not a longitudinal player growth or cloud-save simulation.

The prototype is intentionally not loaded by the game. A real adapter must still
derive home/service/stop/improvement facts from the game, produce timestamped
events from the real economy, split intervals at reset and interaction-window
boundaries, and map the reward ledger through level-up logic. It must implement
atomic canonical assignment, progress, replacement and claim transactions, with
server-authoritative revisions and two-device conflict tests. A pure reducer and
caller-supplied expected revision **do not themselves provide cross-device
atomicity or cloud persistence**. Browser storage alone is insufficient.

## Weekly reconciliation

Full task completion remains 98 vouchers, 84 dosh, 14 restock vouchers, 14 wheel
tickets and 1,540 XP per week. Six full days yield 84 task vouchers; seven yield
98. Wheel voucher expectation remains 0.9 random plus 0.2 long-run tenth-spin
bonus, or 1.1/spin. Actual finite-week milestone results depend on the carried
spin count; they are not guaranteed fixed daily bonuses.

With fourteen earned tickets plus seven to fourteen free opportunities, full
completion gives 121.1-128.8 expected vouchers before other sources. For the
tested six-day late-city sequence, twelve earned tickets plus seven to fourteen
free opportunities gives only 104.9-112.6. The accessibility gap therefore matters
to the 110-130 target and cannot be dismissed as UI work.

The live weekly commission still awards **three tickets**, and `Core.award`
still awards one ticket every fifth level. Keeping the weekly grant adds 3.3
long-run expected vouchers, moving the full-completion interval to 124.4-132.1
before level tickets, shop offers or crate spins. A uniform five-variant free
shop pool on three days adds 0.6 expected spins, or 0.66 expected vouchers/week.
Level tickets depend on level gains; do not assign them a flat weekly value.
Direct crate-spin rewards depend on which crates players buy. No legacy source
is removed or rebalanced by this prototype, and the whole reward economy is not
declared balanced.

## Resume point

Choose whether adaptive smaller sets may preserve the daily budget for cities
that cannot support ten distinct goals. Test that fallback and the foundation
handover next. Then implement canonical-save transactions and real-game event
adapters. Only after the five-profile acceptance checks pass should page designs
and the coordinated reward release proceed. Keep all player compensation and
Diamond removals deferred as instructed.
