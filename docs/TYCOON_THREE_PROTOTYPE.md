> Historical implementation/benchmark record. The DOM/SVG 2D renderer has been removed. Tycoon is now 3D-only; see [current games guide](JKTL_STREET_RUN.md).

# Optional React Three Fiber neighbourhood prototype

Open `/play/tycoon?renderer=3d`, or choose **Try 3D** in the existing city toolbar.
**Use 2D** returns to the existing renderer. The default remains 2D. Only the world
renderer changes; both modes use the same Tycoon state, build menu, saves and economy.
No new account, endpoint, migration or save format is introduced.

## Implementation

`CityScene.tsx` dynamically loads `three/Neighbourhood3D.tsx` with `ssr:false` only
when 3D is requested. Three.js, R3F and Drei are outside the default world renderer.
The prototype uses an orthographic camera, responsive framing and Drei pan/pinch/
scroll controls. Existing day/night, zoom, pause and featured-car controls are reused.
Plot selection works through Three raycasting and keyboard-accessible HTML buttons.

The scene uses original procedural low-poly geometry, not downloaded models or
textures. Building levels change height; storefronts, roof equipment, windows,
roads, raised terrain, foliage, pedestrians and cars have real 3D depth. The
existing construction hook provides scaffolding only for accepted new builds.

- `scene-model.ts`: pure typed economy → geometry view models and quality budgets.
- `InstancedBoxes.tsx`: shared box geometry/material batches with per-instance colours.
- `MovingActors.tsx`: one instanced batch for cars and pedestrians, updated imperatively
  in `useFrame`, without per-frame React state updates.
- `WorldDetails.tsx`: instanced foliage and cheap contact-shadow approximations.
- `CameraRig.tsx`: responsive orthographic projection.
- `RenderDriver.tsx`: capped demand-render invalidation and periodic renderer metrics.

## Quality limits

| Setting | Mobile / low | Desktop / high |
| --- | --- | --- |
| Animation render target | 30 FPS scheduling target | 60 FPS scheduling target |
| Pixel ratio | 1 | 1.25 |
| Real-time shadows | Off | One directional light, cached 1024 basic shadow map |
| Moving cars | 4 | 8 |
| Pedestrians | Up to 8 | Up to 16 |
| Contact-shadow approximation | Yes | Yes |
| Postprocessing / reflections | None | None |

These are targets, not guaranteed frame rates. Every viewport starts in low quality. Higher quality is an explicit option. The visible quality selector
can override that choice. Changing quality recreates the canvas so WebGL context
settings are applied correctly. Static shadow maps update only when buildings or lighting change, not for traffic.
Antialiasing is off; capped pixel density controls resolution. The scene contains no remote texture/model fetches;
high quality creates internal shadow-map textures.

`frameloop="demand"` plus a capped invalidation timer prevents an unlimited idle animation loop; input and React/UI updates can request additional frames.
Pause and reduced motion stop the timer and actor animation; camera/UI changes can
still render on demand. Hiding the tab stops the scheduling timer until visible.
Render metrics update once a second, rather than on every animation frame.

## Failure handling and cleanup

Renderer initialization errors and WebGL context loss return to playable 2D with a
short status message. R3F owns scene disposal and the renderer lifecycle. Instancing
buffers, geometry and materials are scoped to the scene; scheduling/listeners are
cleaned up on unmount. Moving actors disable frustum culling because their animated
positions exceed the initial placeholder bounds. The default world still works
without WebGL.

## Validation and measurement

- `node --test tests/three-scene.test.mjs tests/isometric-world.test.mjs tests/tycoon.test.mjs`
- TypeScript and targeted ESLint for the new renderer.
- `npm --ignore-scripts run build` skips unrelated database migration hooks.
- `TYCOON_TEST_ORIGIN=http://localhost:3143 node tests/three-prototype.browser.cjs`

The browser benchmark seeds 12 fictional businesses in local storage and mocks the
account-save GET response. It does not change real customer accounts or production
data. Checks include resource counts, raycast/keyboard selection, quality limits,
renderer switching, reduced motion, pause and context-loss fallback.

Generated artifacts:

- `/workspace/exports/tycoon-three-benchmark.json`
- `/workspace/exports/tycoon-three-desktop-low.png`
- `/workspace/exports/tycoon-three-mobile.png`

The available cloud Chromium uses **SwiftShader software WebGL**, not a physical
Android GPU. A mobile viewport does not emulate a phone's GPU, thermal constraints
or battery. Frame-rate numbers from this environment must retain that qualification.
The prototype remains opt-in pending sustained real-device measurements. Before any
default-renderer change, measure a populated scene for at least 60 seconds on a
modest Android phone, test camera/build interactions, and check thermal/battery use.

## Recorded production benchmark — 30 October 2026

Raw recorded samples: [benchmark JSON](benchmarks/tycoon-three-cloud-2026-10-30.json).

Cloud Chromium used SwiftShader software WebGL. This was a short populated-city test, not a sustained physical-device test. The production build was served locally; all 12 plots were occupied.

| Scenario | FPS range | Median FPS | Draw calls | Triangles | GPU geometries | Internal textures |
| --- | --- | --- | --- | --- | --- | --- |
| desktop-low | 11.8–12.6 | 12.4 | 7 | 10,488 | 7 | 1 |
| desktop-high | 7.5–9 | 7.9 | 7 | 11,160 | 7 | 3 |
| mobile | 29.1–31 | 31 | 7 | 10,488 | 7 | 1 |

Geometry counts stayed stable through each sampling window. Resource-budget, pointer/keyboard selection, pause, reduced-motion, mode-switch and context-loss checks passed. A separate test confirmed playable fallback when WebGL is unavailable.

**Decision:** retain the current 2D default. Mobile-size software rendering reached roughly 30 FPS, while large desktop software rendering remained below the configured targets. No claim of 30/60 FPS on a real phone or desktop GPU is made. The next decision requires sustained measurements on actual target devices.
