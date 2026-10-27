# Shared domain discovery and purchase safeguards

## Delivered in this change

Main's canonical domain page is `/domains`. The existing `/products/domains` URL redirects there. Main reads the existing Business `domain_prices` source, never Go54 or another registrar directly. Enabled extensions and current registration/annual-renewal prices appear automatically; there is no production fallback to a second environment price list. Resources/navigation and sitemap point to the canonical page. Search results remain UI state, with no indexable page per name.

Main's same-origin `POST /api/domains/search` forwards a small validated search to Business `POST /api/public/domain-search`. Business normalizes the name, rejects platform addresses, reads enabled prices, checks up to three extensions, and returns only public retail prices and availability states. It does not expose costs, keys, registrants, tenants, order references, or provider payloads. An input containing a full offered domain uses that domain's extension. Additional extensions use the same existing Team pricing controls.

Business public searches use persistent per-caller rate limits, a shared external-call budget, 60-second confirmed-result caching and five-second inconclusive caching. A lease prevents concurrent requests from repeating the same lookup. Cache entries are invalidated by price revision; retail prices are always read from the current pricing table. Provider timeouts, bad responses, credentials errors and outages yield `UNKNOWN`, never invented availability. The public endpoint does not use DNS failure as evidence of availability. Hosted reverse proxies may aggregate server-to-server callers under one address; the global budget remains enforced.

The existing **configured availability provider** adapter has been extracted and tightened. Its pre-existing JSON contract now needs an exact domain match, explicit non-premium/non-reserved/eligible flags, NGN currency, and a real numeric supplier price within both the recorded purchase budget and retail price before returning `AVAILABLE`. Missing wholesale costs or evidence return `UNKNOWN`. This adapter is **not a Go54 implementation** and its endpoint has not been represented as a Go54 endpoint.

A selected name travels through the existing login, signup and onboarding flow using an allowlisted `next=domains&domain=...` intent. It is a requested name, not a trusted quote or an external redirect. Business rechecks ownership, current pricing and availability before payment. A domain purchase does not require choosing a template or purchasing a website subscription. Connecting to a JKTL website retains the existing website entitlement checks.

Website settings link to domain search even when a website plan is not active. The existing domain dashboard retains order history, registration/expiry dates, renewal information, support and verified connection states. Registrant encryption, verified Paystack payments, signature checks, domain registration holds, tenant isolation, fulfillment reconciliation, renewal reminders and existing domain support remain in use.

## New safety controls

Migration **056_domain_discovery.sql** adds only:

- `domain_purchase_controls`: default-off purchase and automation switches, read-only and end-to-end verification markers, and an audited updater.
- `domain_public_searches`: shared lookup cache, price revision and request lease.

It is included in the existing Business prebuild migration runner. Migration replay preserves existing settings and domains. Database constraints prevent enabling purchases before both verification markers exist. No UI or action in this change fabricates those markers. The Team can pause new purchases without disabling search or existing domain management. Automated registration cannot be enabled in this revision because the Go54 write adapter is not implemented.

The server enforces the purchase switch when creating and resuming checkout. Current prices must match the order's accepted revision, supplier costs must be known, and registration availability is checked freshly before a Paystack checkout is issued. A reserved order that never reached payment initialization can be cancelled atomically. An initializing/uncertain payment must still be reconciled; it is not blindly cancelled or retried. Existing verified paid orders retain manual fulfillment/refund review. No automatic refund, recurring customer billing or customer wallet was added.

## Go54: blocked, not delivered

The official URLs supplied in the brief were attempted with direct HTTPS requests and Chromium:

- `https://api-docs.go54.com/`
- `https://knowledgebase.go54.com/en/article/369-introduction`
- `https://knowledgebase.go54.com/en/collection/85-domain-reseller-api-documentation`

The workspace network proxy returned HTTP 403 for direct requests and `ERR_TUNNEL_CONNECTION_FAILED` in Chromium. These are workspace access failures, not evidence that Go54's service is down. No official authentication or endpoint specification could be read. This runtime also has no Go54/API/domain/payment/database environment bindings available. Deployment environment settings are separate from this runtime. No credentials were printed, renamed or overwritten.

Consequently:

- **No Go54 authentication request was sent.** The exact UTC HMAC token canonicalization, request location and endpoints have not been guessed.
- Go54-native availability and wholesale-price capabilities are **unverified**, not assumed supported or unsupported.
- No Go54 registration, renewal, transfer, wallet debit or other purchase request was sent.
- No automatic registrar provisioning or Vercel attachment was added. Existing manual reconciliation and verified DNS/hosting workflow remain available.
- No live or Paystack sandbox transaction was created. Payment and registration-state tests use existing mocks and local PostgreSQL-compatible fixtures.

Before live purchases can be enabled, make the official documentation accessible (or supply an export), and expose the already configured credential variables securely to the execution environment. Then implement the documented server-only Go54 client with its exact existing variable names; perform a real read-only authentication test; verify available domains, actual supplier costs and restrictions; implement idempotent registration/renewal with uncertain-outcome reconciliation; verify a sandbox or mocked end-to-end workflow; and check the deployed database, mail and connection bindings. A real paid test domain needs explicit authorization. Keep both switches off until those checks are complete.

## Configuration

Main may set `JKTL_DOMAINS_ORIGIN` to the Business deployment origin; the default is `https://business.jktl.com.ng`. This setting is server-only and contains no credential. Business's optional existing `DOMAIN_AVAILABILITY_URL` and `DOMAIN_AVAILABILITY_API_KEY` refer to the configured generic lookup contract above, not a newly invented Go54 endpoint. Main has neither registrar credentials nor a second checkout/order service.
