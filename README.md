# BitCity

A mobile-friendly pixel-art city builder. This build keeps the original BitCity game engine and adds a more mature **Midnight City / Concrete & Moss** interface, sharper pixel-stepped controls, and a corrected four-item bottom navigation layout.

## Run locally

Open `index.html` in a modern browser. Progress is saved in that browser using local storage.

## Publish with GitHub Pages

1. Create a new GitHub repository (for example, `bitcity`).
2. Upload **all files in this folder** to the repository root. Make sure `index.html` is at the root, not inside another folder.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then Save.
5. Wait for GitHub Pages to publish, then open the Pages URL on your phone.

The site is installable as a home-screen web app on supported mobile browsers and includes a basic offline cache. Save data stays in the browser/device where you play; it is not synced between devices in this GitHub Pages build.

## Notes

- The game uses browser local storage for saves. Avoid private/incognito browsing if you want progress to persist.
- The original Claude-specific cloud-save hook is harmless outside Claude; local saving remains active.
- If you update the game later, increment the cache name in `service-worker.js` so browsers fetch the new files.
