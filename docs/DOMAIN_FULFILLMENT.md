# Domain automation with manual fallback

28 October 2026. This extends the existing Business order/payment/domain system. No second ordering system, customer wallet or registrar provider was introduced.

## Current release boundary

The automatic workflow is implemented against a typed **internal verified-adapter boundary** and exercised with synthetic test responses. The production dispatcher deliberately installs **no live response mapper**. Published GO54 request bindings remain available server-side, but live POSTs and automated registration remain disabled. Selecting AUTOMATIC in settings changes the default preference only; it cannot bypass the purchase gates, the absent wallet/response contract, or the compiled-off live POST safeguard.

Manual fulfillment is usable for existing verified paid orders. New checkout still requires the existing deployment verification gates and verified current availability/pricing evidence. An RDAP absence cannot unlock checkout. This release does not claim live automatic provisioning or deployed-database validation.

## One order, two fulfillment methods

Migration `059_domain_fulfillment.sql` adds method, detailed stage, fallback reason, assignee and a separate fulfillment revision to existing `domain_orders`. It preserves their legacy financial statuses, unique domain/order holds, payment references, accepted totals, encrypted contacts, organization ownership and subscription records. The existing `status` remains the financial/legacy lifecycle; `fulfillment_stage` supplies the detailed operational lifecycle:

- PENDING_PAYMENT → PAID.
- Automatic: VERIFYING_AVAILABILITY → PENDING_REGISTRATION → REGISTERING → ACTIVE.
- Safe fallback: MANUAL_REVIEW; the existing manual operator flow moves PAID → PROCESSING → ACTIVE or FAILED.
- A submitted, timed-out or unknown request: RECONCILIATION_REQUIRED.
- Existing FAILED → REFUND_PENDING → REFUNDED controls and actual provider refund receipts remain unchanged. CANCELLED remains supported for unpaid orders.

Database triggers keep stages aligned when legacy financial statuses change. No paid order is re-created or charged again by routing. Customers see plain progress descriptions rather than registrar/internal stage strings.

The server-side verified-payment path routes paid orders after recording the Paystack receipt. Duplicate callbacks reuse that receipt and order. The existing authenticated domain-maintenance cron also repairs un-routed paid orders. Routing records an audit event and one durable customer notice, delivered by existing JKTL-branded email/PWA infrastructure.

The automatic orchestrator requires a verified payment, explicitly enabled purchase controls, an automatic preference, an eligible extension and a verified internal adapter. Its adapter must produce fresh eligibility/availability, a matching domain/period/kind and an authenticated sufficient wallet proof. Durable operation claiming and the provider-wide gate precede submission. The ledger records SUBMITTED before network I/O. HTTP 200 and unverified JSON are never confirmation.

Fallback reasons include disabled automation, administrator selection, manual-only extensions, incomplete contacts, insufficient wallet funds, unconfirmed availability, verified recoverable failures and unverified integration contracts. Existing manual orders are sticky: changing the default never silently starts purchasing an order the team is already handling.

## Uncertain outcomes and manual completion

Never make another registrar purchase while the operation is SUBMITTED or UNKNOWN. A crash after SUBMITTED also needs reconciliation. Database guards reject manual ACTIVE/FAILED transitions while such an operation exists, and prevent a different transaction reference from replacing a confirmed result. Real refund receipts remain recordable.

In the private registrar panel, an authorized owner reviews the actual GO54 account/history or a provider support reference. The reconciliation form records an **operator attestation**, not an automatically verified API response:

- Confirmed: record the actual transaction reference, dates and nameservers; finalize only the local asset/order.
- Not applied: explicitly confirm that no completed **or pending** operation exists, then clear the gate and route the same order to manual review.
- Uncertain: leave the gate closed; do not clear it using elapsed time, DNS or RDAP absence.

A confirmed operation survives local database-finalization failure. The next dispatcher run finalizes locally from the recorded confirmation without resubmitting. The owner form supports the same recovery.

Manual fulfillment still requires processing state, revision checks, actual supplier reference, valid registration/expiry dates and nameservers. No alternative domain is silently substituted. If fulfillment is impossible, use the existing failure/support/full-refund workflow. Customer-approved alternatives require a separate explicit review; this release adds no automatic substitution.

## Team controls

Admin → Domains now includes domain orders, manual fulfillment, registered domains, availability checks, pricing, tasks, audit records, registrar wallet/diagnostics and fulfillment settings.

- Owners retain `manage_domains`: default preference, per-extension manual handling, supported extensions/prices/margins, wallet controls, reconciliation and assignment.
- Support members have `fulfill_domains` and see only orders assigned to their current account. They receive authorized registrant details only for those paid orders. Fulfillment mutations check assignment again in the database update.
- Support cannot change pricing, purchase gates, credentials, wallet settings or reconciliation evidence. Disabled team accounts cannot be assigned.
- Assignment uses a separate revision so stale operator screens cannot overwrite a newer assignment. Financial revisions remain independent.

Credentials stay in secure environment settings, never dashboard form fields. `GO54_API_EMAIL` is now accepted as the preferred existing binding; `GO54_RESELLER_EMAIL` remains compatible. If both are set differently, configuration fails closed. `GO54_API_KEY` is unchanged. Both possible emails are redacted from diagnostics.

## Availability and pricing

Domain input uses browser/server IDNA conversion to ASCII and validates the result against the selected supported extension. URLs, ports, credentials, path syntax and platform-owned domains are rejected. Existing server-side rate limits, bounded/time-limited registry requests, short caches and purchase evidence checks remain.

Public results add the normalized discovery status REGISTERED, APPEARS_AVAILABLE, UNKNOWN or UNSUPPORTED. Internal AVAILABLE remains reserved for the stronger existing eligibility/price proof and is not inferred from APPEARS_AVAILABLE. A NiRA/IANA RDAP not-found result can display “appears available” but supplies no verified registrar offer, restriction or premium-price evidence. Network errors remain UNKNOWN. See [request contracts and NiRA evidence](GO54_REQUEST_CONTRACTS.md).

Existing pricing supports separate registration/renewal/transfer costs, owner-entered verified wholesale snapshots, manual retail prices and integer markups. First-year and renewal prices appear in customer and partner flows. GO54's pricing JSON is still not mapped to retail prices until currency, units and field semantics are verified. Enabling an extension/manual price is an explicit owner action, not an automatic import of unverified provider values.

## Partner access

The existing owner-controlled client-permissions screen includes a new `PURCHASE_DOMAINS` scope. No existing partner receives it automatically. The partner must be approved with accepted terms, have a claimed client workspace, current non-revoked VIEW_ALLOWED_SERVICES and REQUEST_SERVICE_CHANGES grants plus PURCHASE_DOMAINS, and enabled domain-product access. The native order reservation rechecks this grant and locks it against concurrent revocation.

The client-service workspace offers domain ordering/renewal using the same native order and Paystack checkout. Billing uses the actual business owner's email. Registrant details must be explicitly provided with the customer's authorization; partner identity is not copied into the registrant, and assets belong to the client organization. Existing client-order status and authorized native service-request queues remain available. The client owner can resume an existing pending order through My Domains if checkout setup is interrupted; do not create another order. Transfer, lock, nameserver and sensitive EPP management retain the existing team-assisted workflow while live response schemas/reauthentication requirements are pending.

## Deployment and validation

Migration 059 is included in normal migrations and prebuild. It is additive/replayable and does not change any order total. Existing partner permission grants are preserved. New-workspace and production validation still require the deployment's secure DATABASE_URL; this runtime has no deployment connection. The local build skips database application rather than claiming a migration ran in production.

Tests use disposable PostgreSQL-compatible fixtures and explicitly synthetic provider results, not official GO54 JSON. Coverage includes IDNA/status language, duplicate receipts, unpaid routing, default-off gates, concurrent claims, successful mock activation, wallet/contact/availability fallback, ambiguous/time-out handling, blocked manual completion before reconciliation, local-finalization recovery, assignment authorization, stale revisions and explicit/revoked partner scopes. Existing order/refund, request-binding, schema, SQL-parser and partner/permission tests are also run. No paid live registrar call is authorized or executed by this release.

Before enabling live automation: obtain verified success/error/pending and authoritative reconciliation schemas, pricing currency/units/restrictions, the wallet endpoint/contract and retrieval method confirmation; collect/validate all four GO54 contact roles and TLD-specific fields; implement the production response/preflight adapter; verify the deployed database/payment path and credentials; then obtain explicit approval for a controlled live test with a domain and spending limit. Maintain the disabled production gates until that validation succeeds.

Release validation: the 171-test selected regression run passed; the final expanded fulfillment suite passed all 11 tests. Production build, TypeScript, focused ESLint, migration statement parsing and diff checks passed. Local production HTTP checks returned 200 for the public domains page and Business client shell, and 307 redirects to sign-in for team/partner dashboards. The Business shell contains no authenticated order data; its Server Actions enforce the session and organization checks covered by tests. No authenticated browser/deployed-database test was possible in this runtime.
