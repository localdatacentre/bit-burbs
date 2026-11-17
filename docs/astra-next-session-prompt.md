# Copy everything below into Astra

Continue Bit-Burbs as lead developer, game economist and UI designer. Read the
current GitHub main in `localdatacentre/bit-burbs` first. Do not assume a previous
chat's code is live. This is a staged implementation/review task; keep unfinished
rewards, marketplace actions, Diamond removals and compensation out of production.

## Read these exact project files

The review work is on branch `work/daily-task-generator-20261117`, based on main
`83fee17bd4793ec5ae470445002d299caadceef2`. Main may be newer when you start.
Inspect and reconcile the diff rather than overwriting newer changes.

- `docs/earnings-progression-audit-20261117.md`
- `docs/economy-deep-audit-results.json`
- `docs/economy-progression-audit-results.json`
- `docs/reward-supply-audit-results.json`
- `docs/daily-task-generator-20261117.md`
- `docs/daily-task-scenarios.json`
- `docs/rewards-marketplace-plan-20261117.md`
- `docs/rewards-ui-review.html`, `rewards-ui-review.js`, `bit-burbs-art.js`
- `daily-task-core.cjs` and the audit/task tests in `tests/`

The HTML is an interactive design demo, not a production market. It uses its own
local storage key and sample balances. Do not merge its wallet, task, trade or
ownership shortcuts into the real game. Preserve actual Bit-Burbs art and icons.

## Work order

1. Summarise verified main state and compare it to the review branch. Run the
   existing regression, deep economy, progression, daily and reward-supply tests.
   Distinguish passed invariants from failed design acceptance.
2. Resolve task generation before polishing/merging reward pages. The growing
   and no-BinLink fixtures completed ten goals in 95 active simulated minutes.
   Blank, one-business and fully stocked late-city profiles could not fill ten
   meaningful distinct goals under the approved constraints. Do not pad with
   menu taps, needless buildings, dosh spending or premature restocks.
3. Present the concrete adaptive-set proposal for a decision: fewer meaningful
   goals for limited/full-stock cities, preserving the complete daily reward
   budget. A one-bakery example has supplied-home minutes, staffed-workplace
   minutes, one genuinely needed order and 90 selling minutes. This changes the
   ten-task 3/4/3 structure/per-task distribution and milestone thresholds, so it
   is a proposal, not already approved. Also test the blank-city foundation path
   using the actual 8,000 starting coins and zero residents. Do not stop all
   independent work while awaiting that decision.
4. Fix or explicitly reconcile the uncapped road-XP path and enforce settlement
   before economic mutations. Review the live 100-coin Depot versus older free
   design notes, and preserve old boost minutes while accepting new 10-minute
   rewards. Do not change these economic rules silently.
5. Build canonical assignment, progress, replacement and claim transactions with
   idempotency receipts and server revision checks. The isolated reducers do not
   themselves make cloud saves atomic. Test two simultaneous devices and crash
   recovery before calling this reliable.
6. Refine the reviewed page designs, then implement them only in an isolated
   review build with feature gates. Use the game's actual pixel art, fonts and
   icons, crisp model rendering, compact controls and responsive iPhone/PWA
   layouts. Test 320/375/390/430 widths, safe areas, zoom/rotation, keyboard focus,
   reduced motion and reload. Preserve the five-button bottom navigation.
7. Build reliable distinct Diamond ownership before enabling building drops.
   Design and agree verified trading identity without changing the existing
   username-only city flow without approval. Guessing a city username must not
   grant permission to transfer its rare items.
8. Build fixed-price buy/sell first, then direct item trade offers. The full hub
   is required, but currency, fees, cooldowns, gifting, editions, duplicates and
   item effects are pending decisions. State proposals clearly. Recommend Dosh
   settlement and a disclosed seller fee for review; do not label sample prices
   or the prototype's 5% fee approved.

## Approved crate rules — preserve exactly

Crates are bought only with crate vouchers. Unlimited voucher storage, no expiry,
one reward per opening, no crate-voucher reward inside a crate. Restock vouchers
are separate. Costs: Silver 2, Gold 6, Emerald 14, Ruby 30, Diamond 80.

- Silver: 45% 1,500–3,000 coins; 25% 10–20 dosh; 25% one deed; 4% one spin;
  1% two deeds.
- Gold: 35% 8,000–12,000 coins; 25% 20–30 dosh; 30% one deed; 10% one spin.
- Emerald: 25% 18,000–30,000 coins; 25% 40–60 dosh; 38% two deeds; 12% two spins.
- Ruby: 20% 45,000–70,000 coins; 20% 90–130 dosh; 35% four deeds; 15% three spins;
  10% one 10-minute 2× coin boost.
- Diamond: 15% 150,000–220,000 coins; 20% 250–350 dosh; 30% twelve deeds;
  15% eight spins; 10% one 10-minute 2× boost; 10% one Diamond model.

Only Diamond awards buildings. The eight models are `sakura`, `fountain`,
`statue`, `sunhouse`, `pelicanLight`, `tidalBaths`, `civicClock`, `needle`.
Each is 1.25% per opening. Keep their art; add the Diamond category throughout
game, collection, store filtering and viewer. Do not invent editions or wear.

## Approved wheel and task rewards

Wheel: 15% one restock voucher; 10% two restock vouchers; 5% 6,000 coins;
10% 10 dosh; 5% 25 dosh; 10% one deed; 2% two deeds; 20% one crate voucher;
15% two crate vouchers; 8% five crate vouchers. One prize per spin.
Every tenth spin gives two additional crate vouchers, replacing the Gold crate.
One free chance every 12 hours, one opportunity held. Earned tickets bank without
a cap, redeemed singly. Daily milestones supply two earned tickets/day; do not
also add a playtime grant for the same activity.

Approved daily design: ten tasks reset at 6 pm Australia/Brisbane, with three
straightforward/four standard/three challenging. Every task pays one crate
voucher and one dosh, and 10/20/30 XP respectively. Five claims pay one restock
voucher and one ticket. Ten claims pay four extra crate vouchers, one restock
voucher, one ticket, two dosh and 20 XP. Full total: 14 crate vouchers, 12 dosh,
two restock vouchers, two tickets and 220 XP/day. Six days buy a Diamond crate;
the building remains a chance reward. Fallback changes require a decision.

Freeze scopes/targets when assigned and keep them after reload or account/device
switching. One free unclaimed same-difficulty replacement daily, fresh progress.
No nested duplicate goals or fake difficulty. Orders need actual eligibility,
affordability and completion within the session; no waiting out fresh four-hour
stock. At most two maintenance-duration goals and one useful improvement.
Prefer variety where eligible. Claims, both milestones, replacements and daily
assignment must be canonical and retry-safe.

## Bag and page rules

Only inventory objects go to the ordinary bag. Coins/dosh/XP/deeds/crate vouchers/
restock vouchers/wheel tickets credit their own balances immediately. Ordinary
items and moved buildings stay in the bag; stored boost tokens are usable items.
Tradable Diamond copies belong to a separate Diamond collection with stable
server asset IDs, owner and inventory/placed/listed/offered state. A placed copy
must be packed up before sale/trade. It cannot be placed and listed simultaneously.

Review pages: Vault + Wheel, Daily Tasks, Item Bag, Diamond Collection/Inspect,
Trading Hub (Browse/Sell/Trade/Activity), Dosh Shop and Settings. Use the dark
Vault design, actual game icons/font and small tier-coloured diamond emblems.
The sideways opening reel lasts about 3–4 seconds; save the chosen prize and
spend atomically before animating, land on that exact prize and handle skip,
refresh, resize, network failure and reduced motion without a second reward.

Dosh shop: four visible cards, 2×2, fits iPhone without scrolling; 28-offer pool,
at least two mixed bundles daily, three weekly free-offer days, 6 pm Brisbane
refresh. No Diamond building products. The complete approved 28-offer price
table is missing from the saved handoff—recover it before coding purchases.
Do not treat the demo's layout bundles or `Price TBC` cards as approved offers.

Settings: account/avatar, save status and last confirmed sync, manual save,
switch/log out, FPS toggle, supported audio/vibration controls and reduced motion.
Do not expose credentials, recovery secrets or save tokens in UI or dashboard.

## Trading safety and settlement

Use a server ledger, authenticated immutable owner IDs and unique item instances.
Purchases atomically debit buyer, credit seller less disclosed fee, record the
fee sink, transfer the exact asset, close the listing and write a receipt. Two
buyers racing for one listing yield one winner. Stale quotes never silently
change price or item. Cancelling/expiring an unsold listing releases the copy.
Old browser city saves cannot restore a sold item or overwrite market balances.

Direct offers show exact You give/You receive copies and both player identities.
Reserve the sender's offered copies; a stranger cannot lock the recipient's
inventory by sending an unsolicited request. Acceptance validates both owners,
states and offer revision and transfers both sides atomically. Test cancel,
decline, expiry, counteroffer, stale confirmation and save replay. Prototype
recipient acceptance is a local demonstration, not a secure production feature.

Research official Steam/Valve sources in the plan. Borrow inspection, clear
listing/offer review and receipts, not their art or unrelated skin mechanics.
Steam market purchases and direct item trades are separate workflows. No
real-money payments or cash-out are requested. Fees/currency/holds remain choices.

## Economy evidence and unresolved sources

Independent income tests passed across all 115 business levels, with full visible
income, 50% away income, stock expiry, boosts, staffing, deliveries, school,
refunds, arrivals and reset boundaries. Current-live 150-day simulations reached
L100 on days 105–109 under stated two-hour/day assumptions. These are controlled
economy tests, not real player or physical island-layout measurements. Do not
claim the future ten-task release is balanced from these live five-task results.

Reconcile the live three-ticket weekly commission, every-five-level ticket and
direct old crate grants, XP from roads/spins/openings/missions, free shop spins
and crate→spin→voucher feedback. Retiring/replacing legacy rewards is a proposal,
not already approved. Keep the 110–130 weekly voucher aim explicit about what
sources it includes, and distinguish long-run expectations from guarantees.

## Migration and compensation — do not execute early

At coordinated release convert old Silver/Steel→2 vouchers, Gold→6, old
third-tier Diamond→14, Premium→30 once per save. Preserve existing restock
vouchers, banked tickets, active boost expiry and stored boost time. New daily
sets begin at the next 6 pm Brisbane reset after release.

Remove the affected eight Diamond models from current plots in that coordinated
migration; audit unplaced holdings separately. Mate compensation is exactly
1,302,750 coins plus 200 dosh TOTAL, once, only when BOTH crates and wheel are
live. Match the correct player first. It has not been paid. Jared's own account
needs a separate audit/decision. Never invent historical purchase prices.

## Deliverables and communication

Keep work on a separate branch/review build. Report exact tests, failures,
evidence, remaining decisions and concrete previews with working links. Be clear
about live versus prototype versus proposed. Never call cross-device atomicity,
market safety, iPhone/PWA behavior or the whole economy verified without testing
that actual layer. Keep concise lowercase progress updates at least once a minute
so Jared can tell work is continuing. Finish authorized independent work before
asking for a decision. Do not deploy or alter player data without explicit release
authorization after the coordinated changes are ready and reviewable.
