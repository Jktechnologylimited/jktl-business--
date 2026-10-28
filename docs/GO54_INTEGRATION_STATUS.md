# GO54 integration: confirmed contracts, safeguards and remaining blockers

28 October 2026 — Africa/Lagos.

## Latest update

The subsequent [automation and manual-fallback update](DOMAIN_FULFILLMENT.md) extends the existing order with assignment, detailed stages, safe reconciliation and explicit partner purchase grants. Automatic orchestration is mock-tested; live provider mapping and purchases remain disabled.

Public documentation access was restored on 28 October 2026. Published request bindings for registration, renewal, transfer, nameservers, locks, EPP, contacts and synchronization are now implemented and mock-tested. Response fields remain unverified; retrieval GET/POST conflicts are configurable and live POSTs remain disabled. See [verified request contracts and JSON diagnostics](GO54_REQUEST_CONTRACTS.md) for the current details. The initial access failure described below is historical.

## Scope and current release state

This extends the existing JKTL domain product; it does not replace orders, assets, payments, subscriptions, registrant encryption or the existing fulfillment/refund workflow. Automated registrar purchases remain **disabled**. No live GO54 request, wallet debit, registration, renewal, transfer or EPP request was executed during implementation. Automated tests use mocked HTTP and disposable PostgreSQL-compatible fixtures only.

GO54 support's capability confirmation is accepted: registration, renewal, transfer-in, nameserver updates, wallet enquiry, registrar lock/unlock and EPP retrieval are supported. The latest user-supplied official authentication specification and confirmed pricing URL were implemented. Support confirmation of a capability does not supply its missing wire format.

## Documentation access evidence

The initial attempt was blocked by an environment proxy before reaching the documentation services. On retry, the public knowledge-base articles and IANA sources returned HTTP 200 and supplied the request contracts implemented below. NiRA's website and RDAP help endpoint timed out; no authenticated registrar request or live domain lookup was performed.

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

No registrar routes were inferred from article titles or third-party modules. The now-readable official articles supplied the implemented paths and request fields. JSON response examples, wallet details and several method inconsistencies still need provider confirmation.

## Contract and operation matrix

| Operation | Confirmed information | Implemented now | Remaining verification |
| --- | --- | --- | --- |
| Authentication | `username` email header; token = Base64 of hexadecimal HMAC-SHA256, message API key, key email + `:` + UTC `y-m-d H` | Exact server-side implementation with an independently computed test vector, UTC rollover and raw-digest mismatch tests | Real read-only authenticated response; secure deployment bindings |
| Request encoding | PHP `http_build_query` nested forms and JSON responses | Exact named registration nameservers, indexed transfer/update nameservers, all four contact roles and documented field names; bounded JSON parser and redacted diagnostics | TLD-specific domainfields and operational eligibility rules |
| Wholesale pricing | Authenticated **GET `/tlds/pricing`** at the supplied fixed base URL | Real read-only HTTP transport, private five-minute cache/coalescing, no redirects, time/body limits, team-only transport check | Actual success/error schema, currency, annual/multiyear units and premium/restriction fields. Raw JSON is deliberately **not** interpreted as a valid quote or imported into selling prices |
| Registration | `POST /order/domains/register`, documented contact/ns structure | Typed request binding, field validation, mock tests and existing paid-attempt ledger | Live disabled: success/error/pending schemas, wallet and transactional reconciliation still need verification |
| Renewal | `POST /order/domains/renew` | Typed form request and mock tests; paid renewal ledger preserved | Live disabled; response semantics and verified wallet/quote handling |
| Transfer-in | `POST /order/domains/transfer`, EPP and four contact groups | Typed request and indexed nameserver encoding, secret-safe diagnostics, mock tests | Live disabled; response/transfer eligibility and paid customer orchestration require verified contracts |
| Nameserver retrieval/update | GET/POST `/domains/{domain}/nameservers` | Typed read/update requests, configurable retrieval method, mock tests | CALL says GET for retrieval while PHP uses POST; provider confirmation and response schemas pending. Live POST disabled |
| Lock retrieval/update | GET/POST `/domains/{domain}/lock`, `lockstatus` text | Typed read/update requests, configurable retrieval, mock tests | Retrieval-method conflict, unlock semantics and response verification. Live POST disabled |
| EPP retrieval | CALL GET `/domains/{domain}/eppcode` | Typed configurable request, all diagnostic scalar values redacted; no customer disclosure action | PHP sample uses POST; confirm method/schema and owner reauthentication before sensitive customer UI |
| Domain synchronization/reconciliation | POST `/domains/{domain}/sync` and `/transfersync` | Typed form requests, mock tests, existing normalized confirmation ledger | Live POST disabled; authoritative ownership/transaction/pending response mapping remains unverified |
| Wallet balance | Enquiry capability confirmed; **endpoint still unverified** | Private, explicitly operator-entered NGN snapshot, configurable threshold and durable owner-only low-balance emails/dashboard alerts | Actual read-only method/path, currency/units and response structure; no wallet API URL invented. Operator snapshots cannot satisfy the submission guard's fresh **API** balance requirement |

The request adapter is implemented; the integration is intentionally **incomplete at the live-response and customer automation boundary**. It must not be described as live end-to-end automated registration or domain management until those contracts have been implemented and validated.

## Independent availability service

`src/lib/domains/registry.ts` is a separate server-only standards-based RDAP discovery service. It obtains authoritative TLD service bases only from `https://data.iana.org/rdap/dns.json` and uses the RFC 9082 `domain/<name>` lookup shape. The retrieved IANA bootstrap confirms `https://rdap.nic.net.ng/` for the `ng` delegation used by `.ng` and `.com.ng`. No NiRA hostname or WHOIS endpoint was guessed; no WHOIS scraping fallback was introduced.

Registry access is off by default. Set `DOMAIN_RDAP_ENABLED=true` and explicitly allow root TLDs in `DOMAIN_RDAP_ALLOWED_TLDS` only after reviewing their registry access/usage rules. NiRA usage rules and actual live lookup behavior remain unverified because its website and RDAP help endpoint timed out. This is a prepared registry lookup, not a claim of validated live NiRA availability.

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

The current manual fulfillment, support and verified refund paths remain available for existing paid orders. The new internal submission functions have no production GO54 write caller; the existing automation switch still rejects enabling an end-to-end adapter whose response contracts remain unverified.

## Schema, configuration and preservation

Additive migration **057_registrar_operations.sql** is included in the existing prebuild migration list and normal migration runner. It adds private pricing-policy/sync columns, the singleton registrar balance/gate, alert outbox and operation ledger. It drops no table/column, rewrites no order amount, creates no customer wallet and does not touch subscriptions. Migration replay preserves paid receipts and existing configuration. Additive migration **058_go54_diagnostics.sql** stores private sanitized provider evidence and is included in the same prebuild and migration runners.

New secure server-only bindings documented in `.env.example`: `GO54_RESELLER_EMAIL` and `GO54_API_KEY`. No matching existing environment bindings were present here; no deployment variable was renamed or overwritten. The optional RDAP policy settings default off. Preserve `DOMAIN_CONTACT_ENCRYPTION_KEY` unchanged so existing registrant details remain decryptable.

No production database was available in this runtime, so this migration was validated only in disposable fixtures, not applied live. The normal deployment prebuild can apply the additive migration using its existing secure binding. Back up and review the migration with normal operational controls.

## Validation and next required inputs

Tests cover the HMAC vector, nested encoding, exact pricing GET URL/headers, cache/coalescing, malformed/error responses, policy-gated RDAP, registered/not-found/unknown handling, authorization of every new private action, atomic paid-attempt claiming, insufficient/stale/operator balance rejection, timeout replay blocking, reconciliation, local-write failure after registrar success, renewal expiry, price revision/margins, unchanged accepted orders, private owner-only alerts and migration replay.

Existing domain order/payment/refund/discovery and schema/SQL regressions are run alongside the new mock suite. Production build, TypeScript and focused lint checks validate the integration code. No registrar purchase or real payment test is authorized by this release.

Validation results: all six selected regression files pass (`go54-client`, `domain-orders`, `domain-discovery`, `go54-integration`, `schema`, `sql-statements`), including 7 new request/diagnostic tests, 8 GO54/registry/ledger tests and 21 existing domain-order tests. `npm run build`, `tsc --noEmit`, focused ESLint and `git diff --check` pass. The deployment prebuild correctly skipped live migration because this runtime has no DATABASE_URL. Provider requests and email delivery were mocked; no authenticated live registrar or NiRA service was validated.

To finish live customer automation, verify sanitized success/error/pending responses, pricing currency/units and restrictions, the wallet endpoint and response format, retrieval GET/POST methods, TLD-specific registrant requirements and authoritative ownership/transaction reconciliation. The published request paths and contact-role field names are already implemented. Unknown JSON fields remain uninterpreted until confirmed; test fixtures are synthetic rather than official provider examples. Record actual sanitized responses only during administrator-authorized validation, then finalize the response schemas and transactional integration. **Keep automated purchases disabled until explicit live-test approval and successful validation.**
