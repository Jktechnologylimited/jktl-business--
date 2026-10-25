# JKTL games: immediate play and subdomains

## Applications and entry points

| Public address | Hosting project/repository | Behaviour |
| --- | --- | --- |
| `https://jktl.com.ng/games` | `Jktechnologylimited/jktl-main` | Opens the playable Tycoon interface immediately below the Main navigation. |
| `https://jktl.com.ng/games/business-tycoon` | Main | Compatible direct entry into Tycoon, with no marketing hero or Play gate. |
| `https://jktl.com.ng/games/fantasy` | Main | Opens the actual Fantasy interface immediately. |
| `https://games.jktl.com.ng` | `Jktechnologylimited/jktl-business--` | Root rewrites to `/play`, a full-window Tycoon portal with Fantasy/Main links. |
| `https://fantasy.jktl.com.ng` | `Jktechnologylimited/scaling-waffle-gam-fant-jktl` | The existing Fantasy application's public root game. |

Main and the Games portal embed the actual applications. There is no screenshot pretending to be a game and no copied portfolio or game balance. Both Main game pages have a game switcher and standalone-game links; Main's footer and chat widget are hidden on game pages to give the interface the screen.

## Hosting/DNS activation — still required

Code does not create a DNS record or attach a hostname to a Vercel project. This workspace has no Vercel/DNS connector, token or CLI session, so those external settings were not changed or verified.

1. In the Vercel project connected to **jktl-business--**, add **games.jktl.com.ng** as a production domain.
2. In the project connected to **scaling-waffle-gam-fant-jktl**, add **fantasy.jktl.com.ng** as a production domain. This hostname must go to Fantasy's own project, rather than the Business wildcard deployment.
3. In the authoritative DNS panel for **jktl.com.ng**, add/update the `games` and `fantasy` records using the exact CNAME targets/verification records Vercel provides for those project domains. Existing wildcard records do not replace these project bindings.
4. Set Fantasy's existing `APP_URL=https://fantasy.jktl.com.ng` binding. Keep its own `DATABASE_URL`, `AUTH_SECRET` and other existing account-service settings securely configured. No database migration or reseed is required by this change.
5. Deploy all three repositories and confirm HTTPS/domain verification. Open `/games` and `/games/fantasy` on Main, then each standalone domain. Check guest play, returning-user login and private account flows.

Both hostnames are reserved in Business tenant-name validation and routing. If `fantasy.jktl.com.ng` accidentally reaches the Business project, its root returns a clear 503 configuration message instead of displaying a customer site or creating recursive iframes.

## Session and framing behaviour

Tycoon runs inside the original **business.jktl.com.ng** origin even when displayed on Games or Main. Its HttpOnly Business cookie and guest localStorage remain scoped to that origin. This preserves a valid Business session without widening it to every tenant subdomain. Main cannot read the child's cookie or private game document. Embedded Tycoon suppresses the Business PWA installation popup so it does not interrupt the game preview. Standalone Business installation prompts retain their normal behaviour.

Sign-in links navigate the top-level window. Login return destinations are an explicit allowlist: `next=games` returns to the standalone Games address; `next=games-main` returns to Main's Games page; existing `next=tycoon` behaviour remains available. Arbitrary URLs cannot become auth-return destinations.

Tycoon's public game route allows framing only by itself, Main/www, Games and Fantasy. Fantasy allows only its public **root game** to be framed by itself, Main/www and Games. Fantasy's login, admin and other private paths retain `frame-ancestors 'none'` and `X-Frame-Options: DENY`; game links to those areas navigate at the top level. Neither application allows wildcard tenant subdomains to frame the game.

Server-side staging overrides are optional: `GAME_BUSINESS_ORIGIN` changes the Business iframe source; `FANTASY_APP_ORIGIN` changes the Fantasy iframe source. Production defaults are the intended JKTL domains. These public-page iframe URLs can be prerendered, so rebuild after changing the overrides. `GAME_LOCAL_FRAME_ORIGINS` is a comma-separated, localhost-only allowance for local cross-port browser tests; it is unset in the normal production configuration.

Fantasy retains its separate Auth.js accounts and ranked-game service. This change does not merge Fantasy leaderboards or credentials into Business. Its guest practice mode remains open without signing in.

## Visuals and guest availability

Tycoon uses a 2D isometric island with floating balances, founder level, business-income labels, a compact game dock and contextual panels. Buildings, streets, customers, luxury-car traffic, day/night and zoom remain interactive. The existing fictional economy, guest persistence, account saves and money rules are preserved. Civic towers and the harbour are decorative scenery, not additional owned businesses or income sources.

Fantasy uses the repository's existing isometric Lagos world and guest-trading implementation. The first-visit splash is removed from the game route. If the Fantasy environment or live data service is unavailable, the public game still opens with fictional reference prices and an explicit **Offline practice** label. These browser-only practice trades never enter ranked portfolios or leaderboards. Configured account/marketing/admin areas retain their environment checks and server authorization. No production data was seeded or altered.

## Validation

All three production builds pass. Business's full test suite passes **538 tests**, including the new host-routing, tenant reservation and auth-return allowlist checks. Fantasy's **81 unit tests** pass, including its public-only framing policy; its database integration suite was not run because no dedicated `_test` database is bound here. Type checks and targeted lint pass.

Browser checks run against three local production servers and the real embedded game interfaces. They cover immediate play without a Play gate, a Tycoon purchase and reload persistence, Fantasy practice buying/XP, top-level sign-in links, expected game-host routing and wrong-project protection, framing headers, PWA suppression inside a frame and 390px/320px layouts. No real account, ranked trade, deployment alias, DNS record or investment was created. Production domain activation and live authenticated gameplay remain unverified.
