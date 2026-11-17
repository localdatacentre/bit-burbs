# Latest user direction — 17 November 2026

This section supersedes conflicting combined-page or Vault terminology below.

- The pages are named **Crates** and **Lucky Wheel**. They remain separate pages,
  with separate existing game entry points. Do not merge them into tabs or call
  them The Vault. Revamp and review each page individually. Preserve all current
  access points when adapting navigation; the preview rail is not production navigation.
- Each Diamond model gets a Steam-inspired item market detail page, implemented
  with original Bit-Burbs art and styling. Show a timeline with a price-history
  line, actual completed sale history and current listings separately.
- Range choices: 24h, 7d, 30d and All. Hover/tap a point to show time, sale price
  in the chosen market currency and completed volume. Use the currency actually
  selected for the market; Dosh remains a proposal until decided.
- Display **last sold** (latest eligible completed transaction), **typical sold
  price** (median of eligible completed sales over the selected window), volume,
  lowest current ask and highest funded buy order (when buy orders exist).
  These are distinct values, never a guaranteed item value or buyback price.
- With sparse data show individual sale points and the sale count; connect only
  real observations, without fabricated interpolation across empty periods.
  Use sensible time buckets at higher volume with median price and volume bars.
  A single completed sale is a point, not a manufactured trend line.
- Never populate the graph from unsold listings, guide prices, direct item swaps,
  gifts or a guessed Dosh value of an item-for-item trade. A last sale is still
  shown as last sold if excluded from the reference series, with its flagged
  status; suspicious trades must not silently establish a baseline.
- Price reference eligibility excludes self-trades and flagged linked-account or
  repeated-pair manipulation. Keep the full transaction audit privately. Publish
  only aggregate market data and permitted public seller information.
- With no reliable sales show **No sales yet** or **Not enough sales to show a
  reliable market price**. Launch guide prices, if approved, are separately
  labelled. Do not raise listing caps automatically from a few high sales.
- Server records need model/edition identity (only if editions are approved),
  asset and transaction IDs, integer executed price/currency, fee, completed-at
  timestamp and eligibility/review state. Count each transaction once. Query
  ranges and buckets on the server; timestamps render in the player's locale.
- Inspect → price history → current asks → review exact purchase stays within
  the trading hub. Existing buyer/seller receipts and personal account activity
  remain separate from the model-wide history.
- Acceptance checks: last sale versus median differs correctly; no sale data
  invents no price; listing-only changes never move the chart; duplicate receipts
  count once; suspicious paired sales do not move the reference; swaps do not
  receive artificial prices; range selection, touch tooltip, dates, volume,
  zero-volume gaps and late/corrected transactions behave correctly.

The graph specification is now part of the agreed market direction. Production
history aggregation, graph rendering and manipulation controls still need to be
implemented and tested; the split page mockups do not make them live.

---

# Bit-Burbs — rewards, inventory, pages and player market

17 November 2026. Design and implementation handoff, not a production release.
Source of truth: latest GitHub main in `localdatacentre/bit-burbs`; pinned audit
baseline `83fee17bd4793ec5ae470445002d299caadceef2`.

## What is ready to review

`rewards-ui-review.html` is a seven-page interactive prototype. It uses extracted
live Bit-Burbs model artwork and pixel icons, Silkscreen/VT323 fonts, dark crate-page
colours and compact mobile cards. Its data is explicitly a local demonstration,
not player balances or real marketplace orders. `bit-burbs-art.js` is generated
from the pinned HTML by `tests/build-design-art.cjs`. It is an art-only bundle;
the full game, cloud login and game save code are not loaded.

The preview includes crate buying/opening with exact approved tables, a 3.6-second
sideways reel and skip/reload handling; task cards and milestone presentation;
ordinary bag; Diamond collection and eight-model catalogue; market browse, sell,
trade offers and activity; a four-card Dosh shop layout; and settings. It is a
prototype of flows, not a substitute for canonical backend implementation.

## Latest bag rule

Jared requested that only items go to the player bag and that tradable Diamond
items have their own trading system. Working interpretation for review:

| Reward or holding | Destination | What happens |
|---|---|---|
| Coins | Coin balance | Credit immediately; no bag card |
| Dosh | Dosh balance | Credit immediately; no bag card |
| XP | Progression ledger | Award through the existing level-up code |
| Deeds | Deed balance | Count beside upgrades and purchases |
| Crate vouchers | Voucher balance and Vault | Spend on one crate; unlimited storage |
| Restock vouchers | Depot/restock balance | Waive one full restock fee; retain delivery wait |
| Wheel tickets | Wheel balance | Bank without a cap; spend one per spin |
| Stored boost token | Ordinary bag | A usable item; activate deliberately |
| Moved ordinary building | Ordinary bag | Retain level, purchase basis and identity; restore free |
| Non-Diamond cosmetic/decor item | Ordinary bag | Place/use; not player tradable |
| Diamond model copy | Diamond collection | A distinct server-owned asset; place, list or offer |

The distinction is between balances and inventory objects, not between worthless
and valuable rewards. A collection count must never be inferred from a currency
card or from `S.items` and `S.shopItems` simultaneously. Existing values must be
migrated without counting the same physical copy twice.

## Research: what to borrow from Counter-Strike and Steam

Primary references checked on 17 November 2026:

1. [Steam Community Market FAQ](https://help.steampowered.com/en/faqs/view/61F0-72B7-9A18-C70B)
   — inventory-based selling, cancellable unsold listings, transaction history,
   disclosed fees and commodity buy orders.
2. [Steam Community Market](https://steamcommunity.com/market/)
   — search, active listings and market history are distinct parts of the hub.
3. [Steam Trade Offers](https://help.steampowered.com/en/faqs/view/1115-91C5-050C-1D60)
   — direct offers are a separate workflow; Steam Wallet funds are not included
   in direct trades.
4. [Trade Protected Items](https://help.steampowered.com/en/faqs/view/365F-4BEE-2AE2-7BDD)
   — current CS2 traded items have a seven-day protected period. This is not the
   same as assuming every trade is held in escrow before delivery.
5. [Trading and Market Restrictions](https://help.steampowered.com/en/faqs/view/451E-96B3-D194-50FC)
   — eligibility and restrictions are visible account/item states.
6. [Valve Arms Deal](https://www.counter-strike.net/armsdeal/)
   — collections and case contents support item discovery and inspection.
7. [Valve Weapon Finishes Guide](https://www.counter-strike.net/workshop/workshopfinishes)
   — wear, patterns and appearance variation are authored systems, not features
   Bit-Burbs should claim simply because it uses tradable items.

Our design inference: keep clear inspection, one selected reward, a readable
collection, exact offer review and receipts. Use the approved Bit-Burbs odds and
voucher prices. Do not copy Steam artwork, introduce keys, add weapon-skin wear,
invent editions, add real-money cash-out or pretend Bit-Burbs has Steam's account
protection infrastructure. The proposed 3.6-second reel is our approved direction,
not a claim about CS2's exact current animation duration.

Steam's documented fees include a platform fee and a CS2 publisher component;
those are not a direct endorsement of a 15% all-in Bit-Burbs fee or a simple
seller-net formula. The simpler Bit-Burbs fee below is an independent proposal.

## Decisions: approved versus proposed

Approved: five crate tiers and voucher prices, exact reward odds, one reward per
opening, no crate-voucher drops inside crates, Diamond-only building rewards,
the eight model IDs, wheel table, free-spin cadence, task budget/reset, one daily
replacement, four shop cards, existing-crate conversion and coordinated release.

New user direction: balances stay out of the ordinary bag, with tradable Diamond
items in a separate collection/trading area, plus complete settings/task/market
page designs and an Astra handoff.

Still proposed: market currency and fees, direct-trade terms, duplicate policy,
edition policy, item effects, verified ownership setup, cooldowns, smaller daily
sets and any changes to legacy weekly/level rewards. Prototyping a proposal is
not approval to ship it.

## Page-by-page UX

### Shared mobile shell

Keep the five bottom buttons and the current HUD. The review rail is not a sixth
in-game navigation system. Preserve aligned BIT-BURBS/BETA left edges, evenly
spaced currency amounts and green `current/needed` XP. Use safe-area insets,
dynamic viewport sizing and one primary vertical page scroll. No fixed-height
overlay should hide a claim or confirmation button on iPhone home-screen mode.
Make controls at least about 44 CSS pixels on touch devices. Pixel art renders
with smoothing off; body copy remains readable instead of shrinking to fit.

The custom style is deep blue/navy with warm cream text, gold primary actions,
cyan Diamond accents, thin black edges and restrained bevels. Use small
colour-matched diamond emblems on crates. Use colour and text together for
disabled, ready, claimed, pending, placed and listed states.

### Crates and Lucky Wheel — separate pages

Show selected crate name, price, vouchers available, number affordable, full odds
and a single `Buy & open` action. Keep all five tier choices visible. The crate
stage must reserve room around the top-left name; it must not overlap `xx ready`.
The Diamond detail sheet lists every model and its 1.25% absolute opening chance.

Transaction order: validate balance → atomically spend vouchers and record one
reward/receipt → return that receipt → animate its exact prize → reveal where it
went. The reveal says `Added to coin balance`, `Stored in item bag` or `Added to
Diamond collection`, as appropriate. Reel filler has no influence on the prize.

Use 3–4 seconds with a fixed marker, horizontal pixel cards and optional subtle
ticks. Skip and reduced motion reveal the saved result immediately. Reload must
resume/reveal the original receipt. If the animation fails, ownership still
exists; if the transaction fails, no opening is shown as successful. Avoid fake
near-misses that misrepresent the item's actual odds.

The separate Lucky Wheel page shows one free opportunity, next-ready time, banked tickets,
one-spin action, exact odds and the carried tenth-spin bonus. No keys or obsolete
rent-collection ticket bar. Never add a second two-tickets-per-playtime source
on top of task milestone tickets.

### Daily tasks

Top line: claimed count and next 6 pm Brisbane reset. Two compact milestone cards
stay above the task list. Each task shows exact goal/scope, frozen quantity,
pixel-granularity progress bar, difficulty, XP and currency reward. Show `Claim`
only when ready; unavailable actions have washed-out styling.

Replacement confirmation shows the current goal, same reward/difficulty promise,
one-free-use status and that the new task begins from zero. It must not inherit
earlier unrelated progress. Claims and both milestones commit before an animation.

Release blocker: tests found no honest ten-goal set for a blank/one-business city
or an established fully stocked city with no useful improvement. Do not pad with
menu tapping or early restocks. The proposed fallback uses fewer meaningful
goals with the same total daily budget. Review that change, test it and then
design its exact card layout. See `daily-task-generator-20261117.md`.

### Ordinary item bag

Sections: moved ordinary buildings and usable stored items. Item cards display
name, count, upgrade level when relevant and one contextual action. Moved
buildings keep their purchase basis and do not grant build/development XP again.
Stored boost items are used deliberately. Do not show coins, dosh, XP, deeds,
crate vouchers, restock vouchers or spin tickets as physical cards.

Provide a clearly labelled link to the Diamond collection rather than hiding
tradable copies among ordinary moved buildings. An empty bag should be useful
and quiet; do not manufacture rewards or push purchases to fill it.

### Diamond collection and inspect

Tabs: Owned and All 8 models. Owned filters can later include available, placed,
listed and offered. Each copy exposes its server asset ID in details, current
state and permitted actions. User-facing model names stay unchanged:

| Model ID | Name |
|---|---|
| sakura | Flowering Gum |
| fountain | Grand Fountain |
| statue | Golden Bull |
| sunhouse | Glasswing Conservatory |
| pelicanLight | Pelican Point Lighthouse |
| tidalBaths | Saltwater Baths |
| civicClock | Federation Clocktower |
| needle | Observation Tower |

Inspect supports the existing four sides and day/night artwork where available.
Existing model renderer keys differ from model IDs (`sakura` uses `cherry`, for
example); reuse the game's mapping instead of inventing paths. The prototype
shows front/day. Full four-side/night inspection is a production acceptance item.

Recommended duplicate policy: allow multiple copies as distinct asset IDs; stack
visually by model only in collection summaries. Selecting `Sell` or `Trade`
chooses a specific copy. No invented scarcity counter, serial/edition pricing,
float values or StatTrak-like upgrades. Recommend cosmetic-only market items,
but first audit existing happiness/radius effects and get approval before
changing them; several existing Diamond models currently provide city bonuses.

### Trading hub — browse/buy

Tabs: Browse, Sell, Trade and Activity. Search is by model name; sort by lowest
ask, name or latest listing. Each listing shows actual item artwork, model,
seller display name, availability and buyer's total price. Model detail may show
lowest current ask and recent executed sales only when data exists.

`Review purchase` shows the exact copy, owner, buyer pays, fee and seller receives.
A sold/stale listing gives a plain unavailable state and refreshes results;
never silently substitute a different item or a higher price. Show a receipt
after a successful atomic purchase. A cancel action before final purchase
returns to browse without charging anything.

### Trading hub — sell

Only available, unplaced Diamond assets can be listed. A placed item requires
`Pack up before selling`, which changes its authoritative placement state first.
The price form shows integer price, fee, net proceeds and expiry. A listing
reserves exactly one copy. Listed assets cannot be placed or offered elsewhere.
Unsold listings can be cancelled; sold listings cannot. Repricing cancels/replaces
the old listing atomically with a new quote/version.

Recommended initial rules for review: Dosh settlement using existing balances;
seller fee 5%, rounded up, minimum 1 Dosh; minimum price 2 Dosh; no listing fee;
seven-day listing expiry; no real-money payments, withdrawals or cash-out. At
100 Dosh the buyer pays 100, seller gets 95 and 5 is removed. At 120, seller gets
114 and 6 is removed. Do not silently adopt these as final economy decisions.

### Trading hub — direct offers

Phase two, after fixed-price trading works. Support Diamond-item-for-Diamond-item
offers with a visible `You give` and `You receive` review. Start with one copy
per side; a later capped bundle limit can be reviewed. Recommend no currency
top-ups, gifting or public chat in the first direct-trade release. These are
scope proposals, not a rejection of Jared's trading request.

The sender reserves their offered copy. The recipient's requested copy is not
locked by a stranger's unsolicited offer. On acceptance, validate and lock both
assets together; both ownership changes succeed or neither does. Counteroffers
create a new immutable revision, cancel the previous revision and require fresh
acceptance. Expiry/decline/cancel release sender reservations. Show both player
names and the full current item set again at final acceptance.

A 24-hour offer expiry is a proposed starter setting. Decide transfer cooldowns
and fraud recovery explicitly. Steam's seven-day CS2 protection is research, not
an automatic Bit-Burbs requirement or a feature this project already has.

### Trading hub — activity

Separate sales, purchases, trades, cancellations and expired orders. Each
completed transaction has a timestamp, receipt ID, assets, counterparty and
wallet delta. Label recent executed prices clearly; unsold asks must not be
charted as market value. Hide chart panels until real history exists. Do not
estimate a player's legacy purchase price from a chart or catalogue price.

### Dosh shop

Four cards in a 2×2 grid fit a narrow iPhone first screen. At least two mixed
bundles daily, 6 pm Brisbane reset, no duplicate/consecutive repeat offers under
the approved rotation policy and an occasional free offer on three weekly days.
All balances credit directly. No Diamond buildings in this shop.

Important recovered-source gap: the saved handoff says the 28-offer price table
was approved but does not contain the full table. The preview deliberately says
`Price TBC` instead of inventing approved prices. Recover that table before
coding purchases. The preview's example bundle contents are layout examples,
not assertions that those specific bundles are in the approved 28.

### Settings

Account header: username/avatar, save state, last confirmed sync and Save city.
Account sheet: switch account and log out with unsynced-progress handling.
Display: FPS counter and motion preference. Audio: sound effects, music and
vibration, only where implemented/supported. The prototype switches are local
preferences; do not call unsupported audio controls finished gameplay.

Accessibility: reduced-motion opening reveal, readable pixel labels, keyboard
focus and touch targets. Keep dangerous reset/export actions in a clearly
separate secondary area with appropriate confirmation. Never expose account
tokens, recovery material or cloud save credentials in page or dashboard HTML.

## Ownership and backend design

Current username-only city access is not enough to authenticate a transferable
asset owner. Keep existing city play unchanged; design a separate verified
trading identity (for example linked account/passkey verification) before market
activation. Choose the method with Jared. Do not silently restore forced
passwords or let a person who guesses a username claim that city's assets.

Authoritative records:

| Record | Essential fields |
|---|---|
| Account | immutable ID, city association, verified trading identity, revision |
| Wallet ledger | account, asset/currency type, integer delta, receipt, balance version |
| Item definition | model ID, category, trade eligibility, approved effect version |
| Item instance | asset ID, owner account ID, model ID, source receipt, state, version |
| Placement | asset ID, city ID, anchor, rotation, placement revision |
| Listing | listing ID, asset ID, seller ID, integer price, fee version, status, expiry |
| Trade offer | ID, revision, sender/recipient, exact give/get IDs, state, expiry |
| Reward receipt | request ID, table version, spent amount, selected reward, committed at |
| Migration receipt | account/city ID, migration version, inputs, outputs, committed at |

Assets occupy exactly one state: inventory, placed, listed or offered. Terminal
transfer/cancel events are journal records, not extra physical copies. Database
constraints and transactions enforce one owner and one active reservation.
Placed assets must have exactly one placement; the other states have none.

Buy transaction: authenticate buyer → lock/validate live listing and item version
→ debit buyer → credit seller less disclosed fee → record fee sink → transfer
owner → close listing → write receipt → commit. Idempotency key returns the
same receipt on retry. Two buyers competing for one listing produce one winner.

Direct-trade transaction validates offer revision, owners and both availability
states, transfers both copies, writes both receipts and commits together. Client
animations and local saves do not mint, delete, list or transfer real assets.
All old game-save sync paths must refuse to overwrite authoritative item state.

Buy orders can follow fixed-price launch. If added, reserve Dosh at order
creation, define matching priority, release unused funds on cancellation and
test partial fills. Steam's commodity matching is a reference; unique-copy and
future edition rules must determine whether Bit-Burbs uses commodity aggregation.

## Economy and supply before launch

Each Diamond opening costs 80 vouchers and produces one Diamond item with 10%
chance. Eight equally likely models mean 1.25% per opening each. Expected cost
is 800 vouchers for any building and 6,400 for a particular model; these are
long-run expectations, not guarantees or a promise to obtain one every ten
openings. Buying one Diamond crate per week gives about 0.1 new item per active
player-week before other voucher sources. Duplicates and player population
therefore matter to market liquidity.

Six complete task days yield 84 guaranteed vouchers, enough to buy the crate,
not enough to guarantee the item inside. The task generator's starter/full-stock
accessibility failures must be resolved before advertising this weekly goal.
Full-completion tasks plus approved wheel baseline yield 121.1–128.8 long-run
expected vouchers/week; the live three-ticket weekly grant, level tickets, crate
spins and shop offers remain separate sources to reconcile.

Do not invent buyback floors, price guarantees, fake market makers, pity counters
or scarcity editions. Observe active listings, executed prices, item creation,
fees, concentration of holdings and failed/stale orders after a small closed
test. Keep economic effects of tradable landmarks from creating uncontrolled
income advantages; get approval for any change to existing effects.

## Release sequence and acceptance gates

1. Finish task fallback/foundation decisions and five-profile completion tests.
   Correct the old 3,000-coin blank fixture to actual 8,000-coin `newGame`.
2. Reconcile legacy XP/ticket/crate sources and fix or explicitly accept the
   uncapped road-placement XP path. Audit normal action settlement boundaries.
3. Implement verified trading ownership, canonical wallet/item ledgers and save
   conflict rules. Test them without production player data.
4. Implement reward receipt transactions, approved crates/wheel, exact daily set
   persistence, replacement and claims. Recover exact Dosh shop offer prices.
5. Integrate the page designs into a review build, using actual game assets and
   source mappings. Test 320/375/390/430 CSS-pixel widths, browser and installed
   iPhone home-screen mode, safe areas, landscape and desktop resizing.
6. Prepare backups and dry-run migrations: old Silver/Steel→2 vouchers, Gold→6,
   old third-tier Diamond→14, Premium→30; preserve restock vouchers, tickets,
   active expiry and stored boost minutes. The live 15-minute normalizer must
   not silently turn new 10-minute tokens into 15-minute rewards.
7. Coordinate building removal/holdings audit and compensation only with BOTH
   crates and wheel live. Match the mate before paying exactly 1,302,750 coins
   plus 200 dosh once; Jared's own city remains a separate decision. Start new
   daily sets at the next 6 pm Brisbane reset. Do not run this from a design demo.
8. Release fixed-price trading to a bounded verified cohort after asset drop
   ownership is reliable. Add direct offers only after atomic buy/sell passes.
   Buy orders, gifting, editions and advanced bundles are subsequent decisions.

Required backend tests: duplicate request IDs, server crash before/after commit,
two simultaneous buyers, seller cancelling during buy, competing device saves,
placed/listed/offered conflicts, stale quote versions, insufficient funds, fee
rounding, expiry at the acceptance boundary, deleted/private partner identity,
duplicate drops, invalid quantities, trade cancel/decline/expiry, restore after
refresh, reset during animation and migration retry. Verify sum of currency
deltas plus fee sink is zero for transfers, and the item count changes only on
approved mint/remove events.

Required UI tests: all eight actual models render; full odds sum to 100%; Diamond
sub-odds sum to 10%; exact reel landing; skip/reload/reduced-motion same receipt;
first-screen 2×2 shop; no clipped names, balances or `ready` counts; no accidental
currency cards in bag; visible item state and clear disabled reasons; one claim
and one milestone payment; focus stays in confirmation dialogs and returns to
the initiating control. Cloud/iPhone checks still need real supported devices.

## What Astra should do next

Use `astra-next-session-prompt.md`. Read actual current main and this review
branch before editing. Keep unapproved market/fallback choices explicit. Begin
with the release blockers, then adapt the reviewed pages; do not deploy a
visually complete but financially unsafe market or pay compensation early.
