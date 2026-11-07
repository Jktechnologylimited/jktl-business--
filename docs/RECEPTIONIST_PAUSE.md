# AI receptionist product pause

The shared `src/lib/ai/availability.ts` switch deliberately pauses call recovery and automated receptionist bookings until a reviewed launch. This is independent of the platform support chatbot, customer website chatbots and ordinary manual/public booking tools.

Enforcement covers voice webhook aliases, missed-call interception, widget-session creation, chat turns (including quick-reply bookings), new receptionist checkout/top-up actions, enabling automatic charging, automatic contract collection and JKTL line-rental debits. Standalone and daily receptionist operational reminder jobs skip the paused product. Incoming verified-payment reconciliation remains available so previously captured payments are not lost. Cancellation, records and payment history are preserved.

The receptionist workspace shows an unavailable notice and a free-website destination. It is removed from active Business navigation. New payment controls are disabled in historical billing. Main's product page shows the pause, and navigation/setup messaging focuses on websites, domains and business email.

The database audit records prior activation/auto-charge flags. Both existing auto-charge flags were turned off; no contracts, customers, bookings or payment records were deleted. No provider numbers or external service contracts were cancelled. This application pause does not cancel any provider's own billing.

Before re-enabling: verify provider routing, authorization, booking ownership, duplicate prevention and spending controls; review existing contract schedules so paused months are not silently collected; obtain appropriate customer authorization before enabling charges. Do not blanket-enable stored flags. New product availability requires an explicit reviewed code change to the shared switch.

The games hub and existing Games menu lead to free websites and Main's `/tools/seo-checker`. Nigeria trends use Google's public RSS feed, with source links and a 30-minute cache. No account is needed to explore or play. See Main's `docs/PUBLIC_GROWTH_TOOLS.md` for the SEO checker and feed boundaries.

## Subtle game billboards

Tycoon and Street Run now render roadside signs inside their 3D worlds. They do not use screen overlays, add obstacles or change game rewards. Low graphics quality draws at most two signs; high quality at most three. Text is painted onto small reusable canvas textures, disposed on change. The free-website sign stays separate from the rotating match/news signs. Rotation stops for reduced-motion preferences; network polling stops in hidden tabs. Dragging the city camera does not open a sign link.

`/api/game-world-feed` combines ESPN's public scoreboards for Premier League, La Liga and Champions League, BBC Africa RSS headlines and Google Trends Nigeria. Sources and dates are available in the existing Games menu and beside Main's game interface. This is selected competition coverage, not every worldwide fixture or a video stream. The public endpoints were checked against real responses; availability and provider formats can change.

Only provider state `in` is called LIVE, and only with an observation at most two minutes old. Upcoming games show WAT kick-off times. FT requires the provider's completed flag; postponed games do not show an invented 0–0 result. Stale observations lose their score/live label. News/trends older than 48 hours are excluded from the billboards. Failures do not invent matches or headlines. Match fetches are cached/coalesced for one minute; source headlines/trends use their existing longer caches. The accessible panel labels delayed data and partial coverage.

Promotion wording is “Got 5 minutes? Start your free website.” It links to the public template gallery. It is not a guarantee that every customer can finish and publish a site in five minutes. No clicks, signups, news links or purchases are triggered automatically.
