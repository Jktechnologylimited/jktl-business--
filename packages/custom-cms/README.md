# JKTL Custom CMS adapter

Server-only, dependency-free integration contract for independent Next.js applications. This package does not connect to a site's database, bypass its permissions, or create a universal CMS schema. Copy/vendor this directory into the application's repository; it is not published to npm.

## Pilot integration

1. Add the custom project and HTTPS callback URL in JKTL Admin. Generate a per-project integration key and store the one-time value as `JKTL_CUSTOM_API_KEY` in the **website's server environment**, alongside `JKTL_CUSTOM_PROJECT_ID`. No `NEXT_PUBLIC_` keys. Business retains only its SHA-256 hash. Never supply the website's database URL to Business.
2. Implement the website callback as a server route. Read `jktl_code` and `jktl_project`, require the exact configured project ID, then call `exchangeJktlGrant`. Codes expire after 90 seconds and can be exchanged once. The API key authenticates the website to Business, not the browser. Use HTTPS, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`; redact query strings in request/error logs.
3. Map the returned immutable Business user/organization/project identity to this site's own permitted CMS roles. Validate organization and explicit user allowlist; never grant a site administrator role based only on an email or accept arbitrary organization IDs from the browser. The portal grants content scopes only: no billing, account administration, school records, ticketing permissions or database access.
4. Create a short, revocable, server-side CMS session using an HttpOnly/Secure/SameSite cookie. Redirect immediately to a fixed `/cms` URL to remove the code from the address bar. Do not accept a callback `next` URL. The website must enforce session expiry (recommended 15 minutes), its own revocation/access rules and CSRF protection. Central project revocation prevents new grants, but does not delete existing application sessions: revoke those separately or introspect access for sensitive operations.
5. Build the permitted editing screens using the site's existing content schema and validation. `publishJktlContent` requires site authorization, an atomic content+audit persistence function, and cache revalidation. Use `revalidatePath`/`revalidateTag` with the site's correct Next.js version. Content publishing updates data/cache; it does not deploy new code. GitHub → Vercel continues to deploy code/configuration changes.
6. Test an authorized pilot, wrong user, cross-project code, replay, expiry, revoked membership/key and a real content edit reflected on the live site. Confirm CMS pilot tested in Business only after these pass. Changing callback or rotating key disables launch until reconfirmed.

A law firm's service pages, school announcements and music events can share this authentication/publishing infrastructure while keeping separate models and permissions. Add media upload validation/auditing within each site's existing storage policy. Embedded CMS requires a separately reviewed frame/CSP/CSRF design; the initial adapter opens the authenticated site CMS directly.

No live client website, including K.K. Ubani & Co., has been integrated merely by installing the central portal. The repository and a permitted pilot identity are required for that rollout.


## Current authorization and scoped fields

Declare explicit content scopes and approved field identifiers in Admin → Custom Projects. New integrations default to read-only; changing callback, fields or scopes clears the operator's CMS-test confirmation. Exchange returns only the intersection of issued and current scopes.

Before **each** site editor read/save/publish operation call `validateJktlSession({identity, projectId, apiKey})` server-side. It contacts the fixed Business issuer and checks current project/client/owner membership and scopes. Use the returned narrowed scope, never only a cached cookie's permissions. Failure or timeout must deny editing. Then enforce your site's own resource schema, organization binding, CSRF protections, audit and conditional storage writes. Never map these scopes to general admin, ticketing, school or finance roles. Public website rendering should not depend on Business availability.

The K.K. Ubani pilot uses a thirty-minute signed HttpOnly site session with current authorization checked on each operation, a full-site explicit content manifest and private conditional Blob writes. It remains independently deployed; see that repository's `docs/JKTL_CUSTOM_PILOT.md`. No customer database credential belongs in Business.
