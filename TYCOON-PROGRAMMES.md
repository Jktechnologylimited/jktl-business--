# Sign-in, template photography, programmes and Business Tycoon

The normal, command-centre and affiliate sign-ins now share a navy/gold photographic background with separate credential flows. Their actions, passwords and account types remain independent. The local entrepreneur image is illustrative brand art, not a customer endorsement. The mobile layout removes the decorative photo to prioritise the form.

Both template galleries retain the real template screenshots and add the template's hero photo with an interactive hover/focus treatment. Remote photographs fall back to a bundled entrepreneur image if unavailable. View and Edit links, mobile/desktop preview controls and blank designs retain their existing behaviour. Reduced-motion users do not get card transforms.

Go54 is removed from public domain copy, pricing copy, SEO metadata and all three Nigerian language dictionaries. Internal fulfilment metadata still identifies the registrar. Availability remains a confirmation/quote flow, not an automated registrar search.

## Game

Public entry: Main `/games/business-tycoon`; gameplay: Business `/play/tycoon`. The Business sidebar and mobile More page link to the game. Guests can immediately play a fictional single-player simulation: six Nigerian cities, six businesses, twelve plots, three building levels, 260 weekly turns, operating costs, digital presence, solar resilience and a repayable play-money loan. There is no payment, trading, real security, leaderboard or financial reward. The IPO card expressly describes an imagined scenario inspired by discussion of a possible Dangote refinery listing, not verified market news or an IPO offer. There is no live financial feed.

The game runs on the Business origin and reuses the existing HttpOnly `jktl_session`, validated on the server. This provides no-second-login access for already signed-in Business users without exposing a cookie or introducing cross-domain tokens. Signed-out players can sign in with the allowlisted `next=tycoon` return. Existing admin and affiliate sessions are not business-user sessions.

Guest progress is saved to `jktl-tycoon-guest-v1` in this browser's localStorage. Signed-in users can explicitly save to their account; their progress is not written into guest storage. Migration `032_tycoon_saves.sql` stores one versioned save per user. GET/PUT `/api/tycoon` resolve identity from the session, validate the document, enforce same-origin mutations and use optimistic revisions to prevent stale tabs overwriting a newer save. No tenant or user ID is accepted from the browser. Account connection/storage failures leave guest play open and do not falsely claim a cloud save. Saved game values never affect real business finances or commissions. The additive migration is included in prebuild and `npm run db:migrate`.

## Affiliates and Partners

`/affiliates` describes creators, influencers and educators, preserves the existing commission rules and explains the held signup bonus. Its login label now correctly says Affiliate sign in. `/partners` is a separate programme for developers, marketing agencies, consultants and CAC registration agents with trusted client relationships. It includes the 20-client example without promising income and explains client consent/account ownership.

Partner applications use `/api/partners` with server-side validation and save to the existing service-inquiry queue (`source=partner-programme`, service `JKTL Partners application`). They require contact consent and go to manual review; rates, qualifying purchases and payouts require a written agreement before activation. This implementation does not invent partner commissions, activate partner access, grant client access or change the established affiliate payout engine. Main and Business use their existing database bindings; this workspace has no DATABASE_URL, so production migrations, real cloud saves and inquiry receipt cannot be independently confirmed here.

The requested separate games/fantasy repository was not attached to this workspace. GitHub repository discovery returned Forbidden and guessed clone names were not found. Tycoon was implemented in Business pending the exact repository name/URL; no claim is made that that repository was reviewed or modified.

## Verification

Both production builds passed. The full Business suite passed 529 tests, including play-money accounting, loan interest, solar/digital effects, save validation and a real PostgreSQL-compatible test of user isolation and optimistic save conflicts. Partner-route tests cover origin, consent, validation and database failures. Targeted lint has no errors (native template images retain performance warnings). Browser checks cover all three sign-ins, photo fallbacks in both public template galleries, registrar-free domain text in English/Hausa/Igbo/Yorùbá, mocked partner application success, guest persistence, mocked existing-session account saves, keyboard plot controls and 390px/320px layouts. No real accounts, passwords, payments, applications or customer saves were submitted. Production deployment and live database migration remain unverified.
