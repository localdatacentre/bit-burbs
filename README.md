# Bit-Burbs Update 9

This update simplifies the Progress & Rewards hub by removing the separate ongoing-task system.

## What's included
- Daily Rewards: seven-day login reward track with an independent claim button.
- Daily Tasks: one set of daily objectives, each with its own progress and claim button. Rewards include Dosh, Coins, and Wheel tickets.
- City Rank: rank/level progress, city overview, rating requirements and key city stats.
- Settings: Home Screen gear button; sound, location/daylight and new-city reset controls live in the Settings sheet.
- Tasks badge highlights claimable daily rewards, completed daily objectives and available mayor milestones.
- Legacy ongoing-task data is no longer displayed or used; the rest of the city save is preserved.

## Upload
Replace the existing five files in the root of your GitHub Pages repository with the five files in this ZIP. Keep all files at the repository root.

The service-worker cache is updated to `bit-burbs-v11` so browsers fetch the new build.


## Update 10 – Free Prize jet and reward reveals
- Added a small pixel jet towing a gently rippling FREE PRIZE banner. It crosses the city every 2–3 minutes and automatically awards a small random Coins or Dosh bonus.
- Added a full-screen reward reveal with a large matching icon, amount, reward name and celebratory feedback.
- Lucky Wheel wins now use the same reward reveal, including the 10-spin Gold key bonus message.
