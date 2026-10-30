# JKTL 3D games and Street Run

## Play

- `/play/tycoon`: the existing business game now always uses Three.js / React Three Fiber.
- `/play/run`: JKTL Street Run, a playable three-lane 3D endless runner.
- `/play`: existing games shell, with a new Street Run navigation link.

The Tycoon toolbar links to Street Run. The renderer switch, DOM/SVG world, old
sprite renderer and 2D fallback are removed. The existing fictional economy and
Business account saves retain their data format and authorization rules. A WebGL
failure now shows a retry screen; it never silently loads another renderer.

## Runner controls and scoring

Choose **Start running**. Your character automatically runs forward:

- Left/right arrows or A/D: change lanes.
- Up/W/Space: jump road barriers.
- Down/S: slide under overhead signs.
- Avoid vehicles by moving into a free lane.
- P/Escape or the pause button: pause. Choose Resume to continue.
- On phones, use the large action buttons or swipe the canvas left/right/up/down.

Distance earns five points per metre, rounded down; each gold coin adds 50 points.
Speed gradually increases. A collision ends the run, shows the result and offers
**Run again**. Completed runs update the best score and total game points stored
on this browser/device. Repeated processing of the same completed run does not
award points again. Restart creates a fresh run; previous best scores remain.

Points are fictional gameplay scores. They do not change Tycoon cash, account
balances, subscriptions, commissions or payouts. They are not a server-verified
leaderboard or cross-device account rewards. Local records can be cleared or
edited by the browser user and must never authorize paid benefits.

## Architecture

- `src/lib/runner.ts`: pure deterministic simulation, lane controls, collision
  tests, scoring, fixed substeps and local-record validation.
- `src/components/runner/RunnerGame.tsx`: client input controller, HUD, pause/
  restart/end screens and device-local record storage.
- `RunnerScene.tsx`: client-only R3F perspective world, animated runner, instanced
  obstacles, coins and looping street scenery. There are no remote model/font fetches.
- `src/app/play/run/page.tsx`: public server route and page metadata.

The simulation runs from R3F frames through a ref-backed controller. HUD updates
are throttled; controls and phase transitions update immediately. The renderer
uses instancing, DPR 1, a 30 FPS scheduling target and no real-time shadows or
postprocessing. Slower frames are simulated in small fixed substeps to prevent
objects tunnelling through collision checks. Long frame gaps are capped.

The run pauses on tab hiding/window blur and requires explicit resume. The PWA
install prompt is suppressed on the runner route so it cannot interrupt play.
Reduced-motion preferences remove decorative CSS animation; essential running
motion begins only after the player explicitly starts. Canvas context loss or
unavailable WebGL pauses gameplay and exposes Retry 3D.

## Verification

- `node --test tests/runner.test.mjs tests/three-scene.test.mjs tests/isometric-world.test.mjs tests/tycoon.test.mjs`
- `npx tsc --noEmit`
- Targeted ESLint on changed components and routes.
- `TYCOON_TEST_ORIGIN=http://localhost:3142 node tests/runner.browser.cjs`
- Existing 3D browser checks updated for default 3D and retry-only failure handling.
- `npm --ignore-scripts run build` skips unchanged database migration hooks.

Runner browser coverage includes earning points, lane changes, jump, slide, pause,
collision, restart, local best-score persistence and desktop/mobile overflow.
Browser tests use cloud software WebGL; physical-device speed is still unverified.
Previous desktop software-rendering limits remain relevant, so low quality remains
Tycoon's initial quality setting. No production customer records are changed by tests.
