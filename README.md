# Bit-Burbs

A mobile-friendly pixel-art city builder. The game currently runs from a single self-contained HTML file and is deployed from the repository root.

## Current game files

- `index.html` — the game, interface, gameplay logic, and inline graphics.
- `bitburbs-icon.svg` — current blue BB app icon.
- `manifest.webmanifest` — installable app metadata.
- `service-worker.js` — offline caching; current cache version is `bit-burbs-v12`.
- `README.md` — this project note.

## Current features

- City building and management.
- Daily rewards, daily tasks, city rank, and settings.
- Lucky Wheel and reward reveals with matching reward icons.
- A small pixel jet towing a gently animated FREE PRIZE banner, with bonus rewards.
- Mobile landscape layout and installable-app support.

## Deployment

Keep these five files together at the repository root. The service worker precaches the game HTML, manifest, and app icon. When changing cached assets, increment the cache name in `service-worker.js` so returning browsers fetch the latest version.
