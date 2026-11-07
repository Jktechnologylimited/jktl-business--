# Kora Skybound

Original side-scrolling platform adventure at `/play/skybound`, also available on
the existing games subdomain. Artwork is drawn locally with Canvas 2D: Kora wears
a turquoise jacket, braid and saffron scarf, and journeys through Palmwater Coast,
Copperleaf Market and Lantern Heights to restore three beacons. No third-party
characters, sprites, music or branded level layouts are used. No new dependencies,
registration, database, payment flow or customer wallet is introduced.

The client uses a fixed 120 Hz simulation with a bounded accumulator and capped
frame delta. Physics includes horizontal acceleration, adjustable jump height,
coyote time, buffered jumping, one-way raised platforms, gaps, spikes, patrolling
creatures, stomping/bouncing, three hearts, invulnerability after damage and two
checkpoints per world. Collectibles and creature defeats are recorded per world
to prevent repeat farming after respawning. Completing a world awards a bonus;
advancing restores one heart, up to three. Game over and victory stop simulation.

The renderer draws only visible terrain, limits canvas device-pixel ratio to two,
uses parallax scenery and renders paused worlds only when dirty. It adapts the
camera width to portrait, landscape and embedded views. Keyboard: A/D or arrows
to move, Space/W/Up to jump, P/Escape to pause. Touch buttons support simultaneous
movement and jump through pointer capture. Blur, background tabs and opening the
Games menu pause gameplay and clear held input. Optional synthesized sound starts
only after a user gesture, is mutable and is disposed on unmount. Audio failure
never blocks play. Fullscreen is an explicit user action with an error fallback.

Best scores stay on this browser/device and have no cash value. Storage denial
never prevents gameplay. Progress between sessions is not saved. Existing JKTL
login, account saves and score systems for other games are unchanged.

Kora Skybound appears in the shared Games menu, the immediate-play hub, Main's
game picker and Fantasy's existing navigation menu. The existing public-game
framing policy already permits the new route; protected account routes are not
modified.

Validation: `node --test tests/skybound.test.mjs` covers physics, jump heights,
coyote time, collision, collectible/checkpoint uniqueness, damage, invulnerability,
respawning and final phases. A controller using actual movement and jump inputs
completes all three worlds. `SKY_TEST_ORIGIN=http://localhost:3180
MAIN_SKY_TEST_ORIGIN=http://localhost:3181 node tests/skybound.browser.cjs` verifies
mouse/keyboard and real multi-touch input, jumping, menus, pause/resume, mute,
hub/Main launch and 1440×900, 390×844, 844×390 and 320×740 layouts. Browser tests use
local guest play only. Production builds, type checking and targeted lint validate
the code without running database migrations or paid operations.
