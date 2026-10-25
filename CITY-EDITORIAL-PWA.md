# Living city, team publishing and installation

## Business Tycoon

`/play/tycoon` now renders an original SVG 2D city scene. Six venture types have distinctive storefronts/rooftops, shop awnings, windows, trees, signage and upgrade badges. Customers walk to built businesses, disappear at the entrance, then leave; other pedestrians circulate around the neighbourhood. Vehicles include original G-Wagon-style SUVs, Lamborghini-style supercars and Cybertruck-style pickups. They are illustrations, not licensed vehicle assets. The featured-ride selector changes the highlighted vehicle without spending real or play money.

Day/night controls change the streets, skyline and building lights. Zoom supports a closer view with native scrolling. Pause stops all SVG animations, including walking steps. `prefers-reduced-motion` also pauses the city automatically. Plot controls remain keyboard accessible and the mobile page stays within the screen. The business economy, fictional market stories, existing save format, guest trial and account-session saving retain their established behaviour. Opening more ventures adds walking customers. None of the scenery changes balances or creates real financial rewards.

## Blog and Releases & Updates

Public Main routes are `/blog`, `/blog/[slug]`, `/updates`, `/updates/[slug]`. Both sections are in Resources. Articles render Markdown with raw HTML skipped and unsafe link protocols filtered by the Markdown renderer. Public pages have canonical/OpenGraph metadata, article structured data, author/date/read-time, and sitemap entries. Drafts and unpublished articles are never returned by the public feed. Missing articles use Next's not-found/noindex response; streamed HTML can carry HTTP 200 with noindex while the Business feed returns an explicit 404.

Main reads Business's read-only `/api/publications?kind=blog|release[&slug=...]` on each request without a shared secret or a second database connection. The default source is `https://business.jktl.com.ng`. `JKTL_PUBLICATIONS_ORIGIN` is an optional server-side override for staging/self-hosting; localhost fixtures use it only during QA. Public endpoints and SSR reads do not cache editorial documents, so publishing and unpublishing require no Main redeployment. Database/feed outages produce an honest unavailable state, rather than fake posts. Existing legacy `posts` API/database content is not deleted or silently republished.

The Business command centre's `/admin/content` provides a draft/publish editor, an article library, search, a plain-text preview, editable Markdown and optional HTTPS cover URLs. URL and article type become fixed after the first save. Draft/published visibility can be changed; choosing Draft and saving withdraws an article. Revision checks prevent stale tabs overwriting newer work, and failures leave editor text intact. Creator/updater IDs and timestamps are recorded. Current interfaces show the latest 200 team articles and 100 public articles per section.

### Team workflow

1. An owner signs in at `/admin/login` and opens `/admin/team`.
2. Create the colleague's account with the **Editor** role. Share the credential securely; the application does not send it automatically.
3. The editor signs in at `/admin/login` and lands on **Blog & updates**.
4. Choose **New article**, select Blog or Release & update, fill the fields and save a draft or publish.
5. Published items appear on the corresponding Main section. To withdraw one, change visibility to Draft and save.

Owners and editors have `manage_content`. Editors cannot access team management, customer/business data, financial reports, payouts, broadcasts or the lead engine. The Insights page now explicitly checks its capability, and legacy prospect actions check the lead-engine capability rather than accepting any admin session. This closes those alternate entry points for the new role. All publication writes independently enforce a valid, enabled admin session and publishing capability on the server.

Migration **033_editorial.sql** expands the admin-role constraint and adds `jktl_publications` and its public-feed index. The deployment prebuild includes 033; `npm run db:migrate` also applies it. It uses the Business deployment's existing DATABASE_URL. No Main database migration or additional secret is required. This workspace has no DATABASE_URL bound, so production migration/application and actual team credentials cannot be verified locally.

## PWA installation

The Business root includes an accessible native-dialog installation prompt, shown after 1.8 seconds on an eligible first visit. It offers the native browser Install action when `beforeinstallprompt` is available; otherwise device tabs show iPhone/iPad (Safari), Android (Chrome), and desktop instructions. Native install is invoked only after the user clicks. Escape, Close and Not now snooze the prompt for seven days. Installed/standalone apps do not show it; accepted installation is remembered for a year. Installation errors keep manual steps available.

The prompt is restricted to platform hosts and excludes the admin/affiliate areas, customer-site routes and raw/full template previews. Installed-app orientation is no longer portrait-locked, allowing landscape gameplay. The manifest theme now matches JKTL navy. The existing help installation guide remains available for manual installation and now detects platforms without an SSR hydration mismatch.

The service worker cache version is bumped, removing its old cache namespace on activation. API requests, RSC responses and all authenticated HTML are network-only. Failed navigation gets the generic offline screen, never a stored private page. Only immutable Next assets and public installation assets are cached. This prevents stale account/game/editorial data crossing sign-in sessions and prevents an old cached publication feed from undoing an unpublish.

## Verification

Both production builds pass. The full Business suite passes **536 tests**, including the new publication validation, role isolation, real PostgreSQL-compatible draft/publish/unpublish and revision-conflict queries, server-action permission checks, public-feed errors and service-worker private-data exclusions. Targeted ESLint has no errors; editorial native image elements retain performance warnings.

Browser QA uses an isolated mock publication feed and an isolated editor bundle with a stubbed action. It exercises the actual public pages and editor component without posting real content. Backend permission and SQL behaviours are tested separately with PGlite. QA covers animated traffic/customers, pause and reduced motion, night/zoom/ride selection, saved progress, 390px/320px layouts, article metadata/Markdown safety/sitemap/withdrawal, editor draft/publish/failure preservation, iOS installation instructions, the native installation action, snoozing and standalone suppression. No real account, post, payment, domain request or device installation is created.
