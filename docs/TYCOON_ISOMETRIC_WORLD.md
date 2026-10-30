> Historical implementation/benchmark record. The DOM/SVG 2D renderer has been removed. Tycoon is now 3D-only; see [current games guide](JKTL_STREET_RUN.md).

# JKTL Tycoon isometric client architecture

The live Tycoon route remains `/play/tycoon`. The existing `TycoonGame` owns the
fictional economy, guest storage, account saves and build menu. This refactor changes
presentation; it introduces no database migration or new save format.

## Components

- `src/components/tycoon/CityScene.tsx`: client camera, scroll, zoom, day/night,
  motion controls and grid-click → existing slot callback adapter.
- `src/components/tycoon/world/IsometricWorld.tsx`: five absolute DOM layers,
  textured terrain, roads, hover wireframe, sprite actors and floating effects.
- `src/components/tycoon/world/isometric.ts`: pure projection, inverse projection,
  depth and movement helpers; typed `LandPlot` view model.
- `src/components/tycoon/world/useWorldMotion.ts`: a single throttled RAF clock,
  reduced-motion handling and temporary construction states with timer cleanup.
- `src/components/tycoon/CitySprites.tsx`: extracted reusable vehicle, pedestrian,
  tree and memoized dimensional-building artwork.
- `World.module.css` and `CityScene.module.css`: world/camera styling. Tailwind
  continues to style the surrounding application; world geometry lives in scoped CSS.
- `src/app/globals.css`: opt-in `.crisp-pixels` utility for transparent PNG assets.

## Projection and stacking

For grid X = col, Y = row:

```ts
isoX = originX + (col - row) * tileWidth / 2;
isoY = originY + (col + row) * tileHeight / 2;
```

Tile size is 128×64. `screenToGrid` performs the inverse, including fractional
coordinates. No screen-X sorting or plot array index is used for sprite depth.
`depthIndex = round((row + col) * 1000)` uses the requested X+Y rule, scaled to
retain fractional movement precision. Equal depths have deterministic DOM order.

Each layer forms its own positioned stacking context:

1. Terrain, variation and raised island sides.
2. Roads, sidewalks and dashed lane markings.
3. Selected/hovered/focused plot wireframe.
4. All buildings, scaffolding, civic buildings, trees, moving cars and pedestrians.
5. Floating completion text.

Each actor in layer 4 has an absolute ground anchor and its own depth index. Cars
and pedestrians update their world coordinates and depth together. Decorative actors
never intercept input. Plot controls are native keyboard-accessible buttons.

## Plot state and interaction

The existing save format remains `(Plot | null)[]`. `landPlots` derives the richer
view model without modifying it:

```ts
const examplePlots: LandPlot[] = [
  { id: 0, row: 2, col: 2, status: "empty", level: 0, revenue: 0 },
  { id: 1, row: 2, col: 5, status: "building", buildingType: "salon", level: 1, revenue: 34000 },
  { id: 2, row: 2, col: 8, status: "active", buildingType: "agency", level: 2, revenue: 120000 },
];
```

An empty tile click calls `onTileClick(row, col)`, selecting the corresponding
existing plot and opening the build menu. The player chooses and confirms a venture.
Only the existing `gameAction` can approve the purchase. Accepted builds briefly
show scaffolding, then the completed building and a floating completion label.
Rejected purchases never create buildings. Repeated clicks cannot spend cash twice.
Restored saves initialize immediately as active; only subsequent accepted builds
trigger scaffolding. Ownership, income, cash and save data remain unchanged. Construction is a short presentation state,
not a separate economic timer. Pause freezes environmental motion; construction
continues. Reduced motion stops movement and decorative CSS/SMIL animation.

## Shadows, assets and camera

Sprite wrappers and layers use `overflow: visible`; tall buildings extend upward
from their ground anchors. Only the outer scroll camera clips the visible scene.
Buildings use directional `filter: drop-shadow(...)` so alpha cutouts determine
shadows, with different day/night settings. Ordinary HUD card shadows remain.

Current artwork is the existing original SVG building/vehicle art with distinct
roof and wall faces, storefront details, windows and lighting. It is not a new PNG
sprite pack. Future transparent PNG cutouts can replace artwork inside the same
actor anchors, use `.crisp-pixels`, a bottom-centred ground origin and the existing
alpha-shadow rule. Do not add their own independent world z-index layers.

Static terrain/roads and building artwork are memoized. A single 30fps motion
clock drives moving actors, avoids giant delta jumps after backgrounding, and
cleans up its RAF on unmount. Construction timers are cleaned up and generation
checks prevent stale callbacks from completing a rebuilt/reset plot.

## Validation

- `node --test tests/isometric-world.test.mjs tests/tycoon.test.mjs`
- `npx tsc --noEmit`
- Targeted ESLint for the changed TypeScript components.
- `TYCOON_TEST_ORIGIN=http://localhost:3142 node tests/isometric-world.browser.cjs`
- `npm --ignore-scripts run build` (skips unrelated deployment migration hook).

Browser checks use a mocked guest account response and local fictional game state;
no production account, purchase or database records are changed. They cover five
layers, accepted construction, completion FX, keyboard focus, alpha shadows,
night mode, pause, reduced motion and desktop/mobile overflow. Screenshot artifacts
are written to `/workspace/exports/tycoon-isometric-*.png`.
