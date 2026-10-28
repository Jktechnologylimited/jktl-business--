# GO54 integration: confirmed contracts, safeguards and remaining blockers

28 October 2026 — Africa/Lagos.

## Scope and current release state

This extends the existing JKTL domain product; it does not replace orders, assets, payments, subscriptions, registrant encryption or the existing fulfillment/refund workflow. Automated registrar purchases remain **disabled**. No live GO54 request, wallet debit, registration, renewal, transfer or EPP request was executed during implementation. Automated tests use mocked HTTP and disposable PostgreSQL-compatible fixtures only.

GO54 support's capability confirmation is accepted: registration, renewal, transfer-in, nameserver updates, wallet enquiry, registrar lock/unlock and EPP retrieval are supported. The latest user-supplied official authentication specification and confirmed pricing URL were implemented. Support confirmation of a capability does not supply its missing wire format.

## Documentation access evidence

HTTPS requests were attempted to the authenticated documentation, confirmed pricing URL, all seven public knowledge-base articles, IANA's official RDAP bootstrap, IANA's `.ng` delegation page and NiRA's website. The environment proxy rejected CONNECT with HTTP 403, **before reaching those services**. This is not a claim that GO54's public knowledge base is inaccessible to ordinary visitors or that GO54 is down.

Official sources supplied by the user:

- [Index](https://knowledgebase.go54.com/en/collection/85-domain-reseller-api-documentation)
- [Authentication](https://knowledgebase.go54.com/en/article/369-introduction)
- [Registration](https://knowledgebase.go54.com/en/article/370-register-domain)
- [Transfer](https://knowledgebase.go54.com/en/article/371-transfer-domain)
- [Renewal](https://knowledgebase.go54.com/en/article/372-renew-domain)
- [EPP](https://knowledgebase.go54.com/en/article/373-get-epp-code)
- [Nameserver update](https://knowledgebase.go54.com/en/article/380-update-nameservers-of-a-domain)
- [Registrar lock update](https://knowledgebase.go54.com/en/article/381-update-the-registrar-lock-of-a-domain)
- [Authenticated documentation](https://panel.whogohost.com/resellers/domains/api-docs)

No registrar routes were inferred from article numbers/titles, other WHMCS modules, third-party samples or the names of capabilities. Exact remaining PHP/cURL examples and JSON responses have been requested without credentials. This release implements the independent parts while that information is pending.

## Contract and operation matrix

| Operation | Confirmed information | Implemented now | Remaining verification |
| --- | --- | --- | --- |
| Authentication | `username` email header; token = Base64 of hexadecimal HMAC-SHA256, message API key, key email + `:` + UTC `y-m-d H` | Exact server-side implementation with an independently computed test vector, UTC rollover and raw-digest mismatch tests | Real read-only authenticated response; secure deployment bindings |
| Request encoding | PHP `http_build_query` nested form encoding; JSON responses | Bounded PHP-style bracket/index encoding, RFC1738 spaces and scalar flags; JSON-only bounded response reader | Endpoint-specific nested contact/addon/domainfield names |
| Wholesale pricing | Authenticated **GET `/tlds/pricing`** at the supplied fixed base URL | Real read-only HTTP transport, private five-minute cache/coalescing, no redirects, time/body limits, team-only transport check | Actual success/error schema, currency, annual/multiyear units and premium/restriction fields. Raw JSON is deliberately **not** interpreted as a valid quote or imported into selling prices |
| Registration | Capability and top-level `domain`, `regperiod`, `nameservers`, `contacts`, optional `domainfields`/`addons` | Shared encoder; payment/preflight/submission/reconciliation ledger infrastructure tested with mocks | Exact method/path, all four contact-role structures/required fields, TLD-specific registrant requirements, idempotency/transaction/confirmation semantics. **No registration HTTP call implemented or enabled** |
| Renewal | Capability confirmed | Existing paid renewal flow preserved; new ledger supports verified renewal confirmation and existing expiry-based finalization | Exact method/path, period/base-expiry request fields and response semantics. **No renewal HTTP call implemented** |
| Transfer-in | Capability confirmed | Existing authorized support/transfer workflow and transfer-price fields preserved | Exact method/path, EPP/contact structure, eligibility and billing/year rules; paid transfer orchestration is not represented as implemented |
| Nameserver retrieval/update | Update capability confirmed; retrieval requested | Existing owner-scoped nameserver request/confirmation workflow preserved | Both endpoint contracts and response structures; no guessed `/nameservers` API route |
| Lock retrieval/update | Lock/unlock capability confirmed | No fake action that claims the registrar lock changed | Exact endpoints, lock field names and success/error semantics |
| EPP retrieval | Capability confirmed | No EPP endpoint, secret cache, log or email added | Exact path/method/schema and secure owner reauthentication/disclosure design; do not put EPP codes in task messages, audit detail or ordinary notifications |
| Domain synchronization/reconciliation | Required for safe retries | Internal normalized confirmation ledger and recoverable local finalization | Authoritative account-domain/transaction lookup contracts, ownership matching and pending/error semantics. RDAP absence cannot substitute for these |
| Wallet balance | Enquiry capability confirmed; **endpoint still unverified** | Private, explicitly operator-entered NGN snapshot, configurable threshold and durable owner-only low-balance emails/dashboard alerts | Actual read-only method/path, currency/units and response structure; no wallet API URL invented. Operator snapshots cannot satisfy the submission guard's fresh **API** balance requirement |

The implementation is intentionally **incomplete at the registrar write boundary**. It must not be described as live end-to-end automated registration or domain management until those contracts have been implemented and validated.

## Independent availability service

`src/lib/domains/registry.ts` is a separate server-only standards-based RDAP discovery service. It obtains authoritative TLD service bases only from `https://data.iana.org/rdap/dns.json` and uses the RFC 9082 `domain/<name>` lookup shape. `.ng` and `.com.ng` resolve through the `ng` delegation **if an authoritative RDAP service is actually listed**. No NiRA hostname or WHOIS endpoint was guessed; no WHOIS scraping fallback was introduced.

Registry access is off by default. Set `DOMAIN_RDAP_ENABLED=true` and explicitly allow root TLDs in `DOMAIN_RDAP_ALLOWED_TLDS` only after reviewing their registry access/usage rules. The NiRA service and its terms could not be verified from this environment; if `.ng` is not present in the official RDAP bootstrap, it remains UNKNOWN until an official authorized service is verified. This is a prepared registry lookup, not a claim of validated live NiRA availability.

The service bounds response bodies, uses HTTPS/no redirects/timeouts, retains no registry contact entities, caches bootstrap metadata for one day and results for at most a minute, and caps in-process entries. Existing public rate limits, database cache/leases and call budget remain in place. Unsupported TLDs, rate limits, access failures and malformed responses remain UNKNOWN.

- A matching RDAP domain object means **registered/unavailable**.
- A standard RDAP 404 means **no registration record found**, not an available, non-premium, unrestricted registrar offer.
- Checkout still requires the existing authenticated availability/eligibility/price evidence and the default-off purchase controls. DNS/NXDOMAIN and registry 404s cannot unlock payment or registration.
- The optional existing `DOMAIN_AVAILABILITY_URL` / `DOMAIN_AVAILABILITY_API_KEY` contract remains an independently configured authorized-provider adapter, not an invented GO54 availability API. GO54's lack of a domain availability endpoint is now recorded explicitly.

## Private wholesale and balance controls

The existing `/admin/domains` page has a private registrar section, guarded by `manage_domains` on every Server Action. No supplier cost, margin, wallet figure, provider payload, credential or registrar transaction data was added to customer/public APIs.

- Team members with the required capability can record **operator-verified** NGN annual wholesale snapshots while the actual pricing response mapper is pending. This normalized internal input is not presented as GO54's external JSON schema.
- Existing manual selling prices remain unchanged on snapshot updates. An explicit markup policy can apply percentage basis points plus a fixed kobo margin, with integer rounding up and version checks. Explicit manual price edits return that extension to manual mode. Accepted order totals are never repriced.
- Transfer wholesale cost is stored separately; zero means unverified/not configured, not free transfer eligibility.
- Balance records are clearly labelled **operator-entered**, with a timestamp and threshold. They do not create a JKTL customer wallet and do not top up/debit any account.
- A low-threshold crossing queues a durable private alert. Existing domain maintenance sends it only to currently enabled owner-role team email addresses, with leases/retries and stable email idempotency keys. The private dashboard also displays alerts. No real email was sent during tests.
- The read-only pricing button reports only that JSON was received. It never marks authentication/end-to-end verification complete, infers a provider success flag, changes retail prices or enables purchases.

## Duplicate attempts and uncertain outcomes

`src/lib/domains/registrar-operations.ts` is an **internal normalized ledger**, not an invented GO54 wire adapter. It is not exposed through a customer action or installed as a live write worker.

1. Claim only an existing paid order with a matching verified payment receipt. A partial unique index prevents a second outstanding/confirmed attempt for that order.
2. Immediately before a future network submission, require fresh server-produced eligibility/availability evidence, matching domain/kind/years, and a sufficient fresh authenticated NGN registrar balance. Operator wallet snapshots fail this guard.
3. Persist SUBMITTED **before** network I/O. A provider-wide durable gate serializes submissions and stays closed on ambiguity; a process crash does not silently expire into another spend.
4. Timeouts/ambiguous responses enter UNKNOWN. Existing payment/order records stay intact; there is no new customer charge or automatic refund.
5. Only a fresh authoritative registrar account/transaction reconciliation confirming both **not applied** and **not pending** may clear a retry. A timer, browser assertion or RDAP result cannot establish this.
6. Persist a matching registrar transaction reference and actual registration/expiry/nameserver confirmation before creating/extending the customer's asset. Transaction references are unique.
7. If local asset finalization fails after registrar success, retain CONFIRMED and retry only local finalization. Never submit the registration/renewal again. Tests cover this failure boundary and a subsequent two-year renewal.

The current manual fulfillment, support and verified refund paths remain available for existing paid orders. The new internal submission functions have no production GO54 write caller; the existing automation switch still rejects enabling an unimplemented adapter.

## Schema, configuration and preservation

Additive migration **057_registrar_operations.sql** is included in the existing prebuild migration list and normal migration runner. It adds private pricing-policy/sync columns, the singleton registrar balance/gate, alert outbox and operation ledger. It drops no table/column, rewrites no order amount, creates no customer wallet and does not touch subscriptions. Migration replay preserves paid receipts and existing configuration.

New secure server-only bindings documented in `.env.example`: `GO54_RESELLER_EMAIL` and `GO54_API_KEY`. No matching existing environment bindings were present here; no deployment variable was renamed or overwritten. The optional RDAP policy settings default off. Preserve `DOMAIN_CONTACT_ENCRYPTION_KEY` unchanged so existing registrant details remain decryptable.

No production database was available in this runtime, so this migration was validated only in disposable fixtures, not applied live. The normal deployment prebuild can apply the additive migration using its existing secure binding. Back up and review the migration with normal operational controls.

## Validation and next required inputs

Tests cover the HMAC vector, nested encoding, exact pricing GET URL/headers, cache/coalescing, malformed/error responses, policy-gated RDAP, registered/not-found/unknown handling, authorization of every new private action, atomic paid-attempt claiming, insufficient/stale/operator balance rejection, timeout replay blocking, reconciliation, local-write failure after registrar success, renewal expiry, price revision/margins, unchanged accepted orders, private owner-only alerts and migration replay.

Existing domain order/payment/refund/discovery and schema/SQL regressions are run alongside the new mock suite. Production build, TypeScript and focused lint checks validate the integration code. No registrar purchase or real payment test is authorized by this release.

Validation results: all five selected regression files pass (`domain-orders`, `domain-discovery`, `go54-integration`, `schema`, `sql-statements`), including 8 focused GO54/registry/ledger tests and 21 existing domain-order tests. `npm run build`, `tsc --noEmit`, focused ESLint and `git diff --check` pass. The deployment prebuild correctly skipped live migration because this runtime has no DATABASE_URL. Provider requests and email delivery were mocked; no authenticated live registrar or NiRA service was validated.

To finish the missing operations, provide the official method/path and full request/response examples from the linked articles, plus pricing, wallet and domain synchronization contracts. The critical missing details include contact role/field names, mandatory country/TLD fields, response success/error meaning, pending/timeout reconciliation, actual wallet currency/units and authoritative ownership/transaction matching. Never provide API keys in those examples. Then bind only those documented contracts, use mocked end-to-end tests, and request explicit approval for a narrowly scoped live test. **Keep automated purchases disabled until that approval and validation.**
