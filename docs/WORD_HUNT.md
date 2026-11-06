# Word Hunt and game navigation

`/play/word-hunt` is a public, lightweight React word-search game, served by the
Business repository and reachable on the existing games subdomain. It does not
load a 3D engine or require a login or database. Nine-by-nine boards include eight
words, with business, Nigerian places and Nigerian food themes. New puzzles use
seeded random placement with a guaranteed valid fallback; an initial fixed seed
keeps server and client rendering consistent. All eight directions are supported.

Drag with a mouse or touch, or select the two endpoints. Keyboard users move with
arrows and select using Enter/Space; Escape clears selection. Completed words can
intersect. Hints identify a first letter and cost 20 game points; each found letter
earns 10 points and scores cannot become negative. Pause conceals the board and
stops the timer. Background tabs and the Games menu automatically pause a hunt.
Best scores are local device storage only, have no cash value, and are not ranked.
Storage denial does not prevent play.

The shared compact Games menu links to Word Hunt, Street Run, Tycoon and Fantasy,
plus the games hub and Main. It supports outside-click dismissal and Escape.
Runner pauses when opening it. Mobile Tycoon keeps the menu visible alongside its
existing city controls. `/play` keeps immediate Tycoon gameplay and switches its
single iframe rather than loading multiple engines simultaneously. Main's
`/games` and existing Fantasy/Tycoon landing routes use a compact four-game select
and preserve immediate gameplay. Fantasy includes the same game destinations in
its existing menu. Only its public root framing allowance adds the explicit
Business origin; private account routes retain their frame restrictions.

Validation: `node --test tests/word-hunt.test.mjs` checks 600 boards, reproducibility,
word presence, both selection directions, illegal paths, duplicate scoring and
hint arithmetic. `HUNT_TEST_ORIGIN=http://localhost:3180
MAIN_HUNT_TEST_ORIGIN=http://localhost:3181 node tests/word-hunt.browser.cjs` covers
real mouse/touch/keyboard play, pause, hints, completion, stored best, all three
viewport sizes (1440/390/320), hub switching, Main embedding and existing game
menus. Browser tests use guest play and local storage only; no accounts, payments
or database records are created. Local embedding requires the existing
`GAME_LOCAL_FRAME_ORIGINS` allowance and `GAME_BUSINESS_ORIGIN` local override.
