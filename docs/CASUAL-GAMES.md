# JKTL casual games

Four original, guest-play games join the existing five. No accounts, payments, migrations, external art services or extra runtime dependencies are needed.

| Game | Direct public route | Controls / round |
| --- | --- | --- |
| Market Slice | `/play/market-slice` | Swipe or tap fruit; optional keyboard/tap target buttons. Avoid hot coals. Three hearts, 60-second maximum. |
| Market Match | `/play/market-match` | Tap/click/keyboard eight pairs of cards. Match streaks and completion bonus. |
| Lagos Stack | `/play/lagos-stack` | Tap canvas, Drop floor, Space or Enter. Overhang is removed; reach 20 floors. |
| Naija Word Mix | `/play/word-mix` | Tap or type letters, Backspace to undo, Enter to check. Five clues per round; hints reduce points. |

`src/lib/arcade-model.ts` owns deterministic deck/word generation, tower geometry, and fruit simulation. Client components under `src/components/arcade/` own input, presentation and local best scores. Canvas resolution is capped at 2× DPR; paused games stop painting except after resizing. Games automatically pause on window blur, hidden tabs and opening the Games menu.

`src/lib/game-catalog.ts` is the Business catalogue and game-switcher registry. `/play` (also the root of games.jktl.com.ng through the existing host rewrite) offers original SVG covers, search, categories, favourites, recent selections and Pick for me. Selecting a game mounts one iframe; returning to the catalogue unmounts it. Browser Back/Forward and `?game=<known-id>` are supported. Unknown IDs are ignored. No unverified popularity or player counts are displayed.

Main's `/games` intentionally retains immediate Tycoon gameplay, with all nine choices in `components/games/GameStage.tsx`. Keep this small Main registry aligned when adding games. Fantasy retains its existing All games link; its authentication and trading code are unchanged.

Favourites/recent selections and casual best scores are stored on the current browser/origin only, and gracefully tolerate unavailable storage. They are not synchronized account records, verified leaderboards, rewards or cash. Fantasy keeps its own existing persistence.

Original SVG cover illustrations are in `public/game-covers/`; no reference screenshots or third-party game assets were reused.

## Verification

- `node --test tests/arcade-games.test.mjs tests/word-hunt.test.mjs tests/skybound.test.mjs`
- `npx tsc --noEmit` and targeted ESLint.
- `MAIN_ARCADE_TEST_ORIGIN=http://localhost:3181 node tests/arcade-games.browser.cjs` with Business running on 3180 and Main on 3181. This test stubs the unrelated public feature registry; it does not read or alter customer data.
- Business production build: `npm --ignore-scripts run build` (skip database migration prebuild during verification).
- Main production build: `npm run build -- --webpack`.

For local cross-site embedding set Business `GAME_LOCAL_FRAME_ORIGINS=http://localhost:3181` and both servers' `GAME_BUSINESS_ORIGIN=http://localhost:3180`. Production keeps the existing approved public frame origins; no private-page framing policy was loosened.
