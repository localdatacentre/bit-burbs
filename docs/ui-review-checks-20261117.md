# Interactive review checks — 17 November 2026

Tested the isolated browser prototype, not live player data.

- Initial Vault, generated crate pixels and actual currency icons rendered.
- A sample Golden Bull purchase charged 120 demo Dosh once (420→300), removed
  the listing and transferred the copy into the demo Diamond collection.
- Purchase review disclosed a sample 6-Dosh fee and 114-Dosh seller proceeds.
  These are demonstrations of a proposed fee, not approved market prices.
- A Flowering Gum ↔ Glasswing Conservatory offer showed both sides, reserved
  the sender copy, moved to pending and completed on demo recipient acceptance.
- A Silver opening saved a selected 2,362-coin prize. Reload showed that exact
  saved result; the wallet remained 127,762 coins and 96 vouchers after spending
  two vouchers from 98. Refresh did not reroll or award another prize.
- All eight catalogue models produced nonblank-sized actual renderer canvases:
  Flowering Gum 160×104; Fountain 288×144; Bull 160×100; Conservatory 224×125;
  Lighthouse 288×251; Baths 288×152; Clocktower 288×454; Observation Tower 288×391.
- Checked a 375×812 browser viewport. After compacting the shop cards, all four
  were visible with the second row ending at y=678 in the measured view.
- At 375 pixels, measured document width was 360; at 320 pixels, 305. Neither
  produced horizontal document overflow. The outer review rail is deliberately
  horizontally scrollable on mobile; it is not part of the production game.
- Temporary viewport override was reset. The standalone bundled file was opened
  and verified. Demo data was reset before the final preview screenshot.

Not verified: real iOS Safari/Chrome or installed home-screen mode, 390/430-pixel
breakpoints, production cloud transactions, recipient authentication, a real
seller ledger credit, full keyboard focus trap, reliable reduced-motion behavior
on actual devices, four-side/night inspection, every cancel/expiry race or every
production economy path. The prototype's sample settings, task and marketplace
logic must not be copied as a production backend. All review changes remain
outside main and all player compensation remains deferred.

Open `bit-burbs-rewards-review.html` for the self-contained review file. It uses
Google Fonts when available; actual game artwork and page scripts are embedded.
Run `node tests/serve-preview.cjs` for a local browser review at
`http://127.0.0.1:8765/rewards-ui-review.html`.
