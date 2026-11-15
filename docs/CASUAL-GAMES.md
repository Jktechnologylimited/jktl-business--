# JKTL casual games

Four original, guest-play games sit alongside four other available games. Fantasy is paused. No accounts, payments, migrations, external art services or extra runtime dependencies are needed for guest play.

| Game | Direct public route | Controls / round |
| --- | --- | --- |
| Market Slice | `/play/market-slice` | Swipe or tap fruit; optional keyboard/tap target buttons. Avoid hot coals. Three hearts, 60-second maximum. |
| Market Match | `/play/market-match` | Tap/click/keyboard eight pairs of cards. Match streaks and completion bonus. |
| Lagos Stack | `/play/lagos-stack` | Tap canvas, Drop floor, Space or Enter. Overhang is removed; reach 20 floors. |
| Naija Word Mix | `/play/word-mix` | Tap or type letters, Backspace to undo, Enter to check. Five clues per round; hints reduce points. |

`src/lib/arcade-model.ts` owns deterministic deck/word generation, tower geometry, and fruit simulation. Client components under `src/components/arcade/` own input, presentation and local best scores. Canvas resolution is capped at 2× DPR; paused games stop painting except after resizing. Games automatically pause on window blur, hidden tabs and opening the Games menu.

`src/lib/game-catalog.ts` is the Business catalogue and game-switcher registry. `/play` (also the root of games.jktl.com.ng through the existing host rewrite) offers original SVG covers, search, categories, favourites, recent selections and Pick for me. Selecting a game mounts one iframe; returning to the catalogue unmounts it. Browser Back/Forward and `?game=<known-id>` are supported. Unknown IDs are ignored. No unverified popularity or player counts are displayed.

Main's `/games` intentionally retains immediate Tycoon gameplay, with eight available choices in `components/games/GameStage.tsx`. Keep this small Main registry aligned when adding games. Fantasy is paused in Main and Business: remove its public catalogue/menu entry, sitemap entry, Growth card, feature discovery and email promotions. Its older embedded routes temporarily redirect to the available games. The standalone repository and data remain intact; hosting and DNS are unchanged.

Favourites/recent selections and casual best scores are stored on the current browser/origin only, and gracefully tolerate unavailable storage. They are not synchronized account records, verified leaderboards, rewards or cash. Fantasy keeps its own existing persistence.

Original SVG cover illustrations are in `public/game-covers/`; no reference screenshots or third-party game assets were reused.

Fantasy pause verification: 19 catalogue/host/email/public-feature/knowledge tests,
2 Partner service tests and 11 Main SEO/tool tests passed. Both production builds
and TypeScript/targeted lint checks passed. The built apps were checked at 1440px,
390px and 320px: eight choices, working Word Hunt navigation, stale favourites
and `?game=fantasy` handling, clean Main sitemap and no requests to the Fantasy
hostname. The old embedded entry points return static HTTP 307 redirects with
`noindex` and cache hits. The redirect cache has no periodic regeneration; a
future deployment can restore the app. No production data, hosting or DNS was
changed, and the changes remain undeployed.

## Verification

- `node --test tests/arcade-games.test.mjs tests/word-hunt.test.mjs tests/skybound.test.mjs`
- `npx tsc --noEmit` and targeted ESLint.
- `MAIN_ARCADE_TEST_ORIGIN=http://localhost:3181 node tests/arcade-games.browser.cjs` with Business running on 3180 and Main on 3181. This test stubs the unrelated public feature registry; it does not read or alter customer data.
- Business production build: `npm --ignore-scripts run build` (skip database migration prebuild during verification).
- Main production build: `npm run build -- --webpack`.

For local cross-site embedding set Business `GAME_LOCAL_FRAME_ORIGINS=http://localhost:3181` and both servers' `GAME_BUSINESS_ORIGIN=http://localhost:3180`. Production keeps the existing approved public frame origins; no private-page framing policy was loosened.

## Naija Word Mix progression

A win is a completed five-word match, rather than a single solved clue. Matches 1–5 use the Starter pool (5–6 letters). After five completed wins, the next match uses Challenger words (7–9 letters), more indirect clues and at most two hints per word. After ten wins, Expert words (9–12 letters) allow one hint per word. Unlock messages appear on the winning screen. Best-score calculation is unchanged.

Completed wins are saved separately as `jktl-word-mix-wins-v1` in local storage and restored before play. Partial rounds, wrong guesses, pauses and pressing the next-game button do not add wins. Invalid stored counts fall back to zero. If storage is unavailable, progression still works for the current session. This remains guest progress on the current browser/origin, not a synchronized account achievement.

`node tests/word-mix-progression.browser.cjs` (local origin defaults to port 3182) verifies full-match counting, both unlock boundaries, hint limits, reload persistence and long-word controls on narrow and landscape viewports.

Word Mix hints place a correct letter in its actual answer position, highlight it in gold and lock it. A misplaced matching tile is moved into position; displaced guesses return to the letter bank without duplicating tiles. New input fills the first empty slot. Undo and Backspace remove the latest manually chosen letter, preserving hints. Each hint still costs 25 points and respects the current level's hint limit. Hints stop when the answer is already correct. Starting another word or match clears the locks.
