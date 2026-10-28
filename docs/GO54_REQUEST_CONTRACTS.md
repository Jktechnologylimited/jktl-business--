# Verified GO54 request bindings

Inspected from the official public knowledge base on 28 October 2026 (Africa/Lagos). Network access was restored during this task. The authenticated panel was not needed for these request contracts.

## Implemented requests

All paths use `https://www.whogohost.com/host/modules/addons/DomainsReseller/api/index.php`, the existing hourly HMAC headers and URL-encoded POST forms. No registration/renewal/transfer, management mutation or synchronization POST was executed live.

| Binding | Published CALL | Parameters / source |
| --- | --- | --- |
| Registration | `POST /order/domains/register` | `domain`, `regperiod`, associative `nameservers[ns1]` … `[ns5]`, all four `contacts` groups; optional `domainfields` text and `addons`. [370](https://knowledgebase.go54.com/en/article/370-register-domain) |
| Renewal | `POST /order/domains/renew` | `domain`, `regperiod`, optional `addons`. [372](https://knowledgebase.go54.com/en/article/372-renew-domain) |
| Transfer | `POST /order/domains/transfer` | `domain`, `eppcode`, `regperiod`, **indexed** `nameservers[]`, all four contact groups, optional `addons`. [371](https://knowledgebase.go54.com/en/article/371-transfer-domain) |
| Read nameservers | `GET /domains/{domain}/nameservers` | Domain is in the path; configurable retrieval method because the PHP sample conflicts. [378](https://knowledgebase.go54.com/en/article/378-get-the-nameservers-of-a-domain) |
| Update nameservers | `POST /domains/{domain}/nameservers` | `domain`, indexed `nameservers[]`. [380](https://knowledgebase.go54.com/en/article/380-update-nameservers-of-a-domain) |
| Read lock | `GET /domains/{domain}/lock` | Configurable retrieval method. [377](https://knowledgebase.go54.com/en/article/377-get-the-registrar-lock-of-a-domain) |
| Update lock | `POST /domains/{domain}/lock` | `domain`, text `lockstatus`; sample uses `"true"`. The adapter encodes Boolean lock intent as `"true"`/`"false"`; unlock semantics still require provider/live confirmation before enabling it. [381](https://knowledgebase.go54.com/en/article/381-update-the-registrar-lock-of-a-domain) |
| Read EPP | `GET /domains/{domain}/eppcode` | Configurable retrieval method; no public/customer EPP response action has been enabled. [373](https://knowledgebase.go54.com/en/article/373-get-epp-code) |
| Read contacts | `GET /domains/{domain}/contact` | Configurable retrieval method; response and diagnostic privacy restrictions apply. [374](https://knowledgebase.go54.com/en/article/374-get-contact-details) |
| Domain sync | `POST /domains/{domain}/sync` | `domain`. [376](https://knowledgebase.go54.com/en/article/376-sync-the-details-of-a-domain) |
| Transfer sync | `POST /domains/{domain}/transfersync` | `domain`; documented for pending transfers. [375](https://knowledgebase.go54.com/en/article/375-transfer-sync-a-domain) |
| Wholesale pricing | `GET /tlds/pricing` | Support-confirmed path; response mapping/currency/units remain unverified. |

The registration and transfer contact-role keys are exactly **`registrant`, `tech`, `billing`, `admin`**. Each has `firstname`, `lastname`, `fullname`, `companyname`, `email`, `address1`, `address2`, `city`, `state`, `zipcode`, `country`, `phonenumber`. The SDK requires explicit role details, including first and last names; it does not invent legal surnames or silently copy existing customer data into other roles. The published examples use country text such as `Nigeria` and international phone text such as `+234.812345678`. Country/TLD-specific requirements still need operational validation.

Both nameserver counts are bounded to the documented two required and three optional entries. Registration uses named `ns1`/`ns2` keys, while transfer and nameserver updates use indexed entries, matching their distinct examples. Optional addons are only those named in the published examples: `dnsmanagement`, `emailforwarding`, `idprotection`, with explicit 0/1 values; none are automatically enabled or charged. `domainfields` remains text as documented, not an invented nested TLD schema.

## GET/POST inconsistencies

Articles 373, 374, 377 and 378 label retrievals **GET** in CALL, but their PHP examples set `CURLOPT_POST=true` and include a domain form parameter. The implementation defaults to the CALL method, with server-only configuration:

```text
GO54_NAMESERVERS_READ_METHOD=GET
GO54_LOCK_READ_METHOD=GET
GO54_EPP_READ_METHOD=GET
GO54_CONTACTS_READ_METHOD=GET
```

Only GET or POST is accepted. GET uses the domain path; a configured POST uses the documented domain form parameter. No automatic method fallback, authentication-hour retry or repeated mutation occurs after an error. **Live POSTs, including configured retrieval POSTs, remain blocked** until explicit controlled validation and approval. Merely changing an environment method cannot enable a live write. Mocks exercise both configurations. Provider confirmation is still needed to resolve the documentation conflict.

## JSON handling without invented schemas

The introduction confirms JSON responses but these articles contain no complete success/error/pending examples. The client therefore returns `RESPONSE_SCHEMA_UNVERIFIED` with the parsed unknown payload and observed HTTP status. This marker is a **JKTL internal type**, not a GO54 response field.

- Any valid JSON shape is preserved; HTTP-error JSON is parsed too.
- HTTP 200 and valid JSON never activate an order, assert successful authentication, clear a registrar retry gate, import a quote, infer ownership, or supply a wallet balance.
- No `status`, `success`, `transactionId`, EPP, expiry or pending field name is guessed.
- Invalid/empty/oversized JSON is handled with bounded reads, safe diagnostic metadata and no raw error-body logging. A transport failure indicates an unknown outcome, not proof that an operation failed to apply.
- No retries or guessed idempotency headers/parameters are sent.
- The customer purchase worker and live financial operations stay disabled. Existing manual/refund and authoritative-ledger workflows remain intact.

## Private sanitized diagnostic capture

Migration **058_go54_diagnostics.sql** adds a private evidence table without altering customers, orders, assets, payments or subscriptions. Every capture/dashboard action requires `manage_domains`. The domain operations panel has an explicit **Capture read-only pricing diagnostic** button; rendering the page does not contact GO54. The button makes one rate-limited, read-only pricing GET with configured credentials and stores only sanitized evidence. Unlike the separate five-minute pricing cache, diagnostic capture is deliberately fresh. No live capture was executed by Codex.

Unknown field names and non-sensitive values are retained within size/depth/node limits. Credential/token/password/EPP/contact/email/phone/address/name fields are redacted, as are known request secrets reflected under unrelated field names. Potentially email-bearing strings are redacted using a bounded linear-time approach. EPP/contact-read diagnostics redact **every scalar value**, since an undocumented field name might contain a secret or contact detail. Invalid JSON records include only safe internal parse metadata, not the raw body. The persistence helper sanitizes again defensively.

The private dashboard returns only sanitized records, never raw SDK payloads, headers or credentials. The SDK keeps raw unknown JSON server-side for a future verified mapper; callers must not return it to a customer, email it or log it. EPP values are not cached or written to audit/diagnostic messages. Audit entries reference diagnostic IDs rather than embedding responses.

During an explicitly authorized live test, an operator may capture sanitized actual read-only responses, review the observed provider schema and obtain missing examples from GO54. Any live paid registration/renewal/transfer test still needs explicit authorization, a spending limit, a supported wallet contract, a valid registrant/quote preflight and the existing durable submission ledger. This release cannot enable such a test through a runtime flag.

## NiRA discovery evidence

The official [IANA RDAP bootstrap](https://data.iana.org/rdap/dns.json) now confirms **`https://rdap.nic.net.ng/`** for `.ng`. The existing registry client already uses that authoritative bootstrap for `.ng` and `.com.ng`; no hardcoded hostname change was necessary. [IANA's `.ng` record](https://www.iana.org/domains/root/db/ng.html) also identifies `whois.nic.net.ng`. NiRA's website and the RDAP help endpoint timed out from this workspace, so actual service usage rules and live query behavior remain unverified. Registry access stays opt-in/policy-gated; RDAP absence still cannot prove a purchasable offer.

## Validation and remaining work

Mock fixtures are explicitly labelled test data, **not official GO54 response examples**. Tests cover exact paths/methods, registration named nameservers versus indexed transfer/update entries, all four contact groups and every field, form escaping, validation, configurable retrievals, no automatic retries/fallback, HTTP-error JSON, invalid JSON, redaction/resource bounds, owner-only diagnostic capture and unchanged default-off purchase controls. Existing domain/payment/refund and ledger regressions remain in use. TypeScript, lint and production build checks are run before publishing.

The remaining provider-dependent work is response-schema verification, real read-only authentication, pricing currency/units and premium/restriction semantics, wallet endpoint/format, resolution of retrieval-method conflicts and registrar transaction/ownership reconciliation. Only after verified responses are mapped can normal customer registration/renewal/transfer and sensitive management UI be enabled. There is no customer wallet and no production credential or live domain was changed.
