# JKTL AI Chatbot implementation and operations

## Delivered product and reused systems

JKTL AI Chatbot lives at **Business → More → AI Chatbot** (`/business/chatbot`), with a shortcut from Website. It supports customer-created assistants, approved knowledge/FAQs, naming/tone/welcome/branding/contact settings, domain verification, usage reporting, conversation deletion, leads, WhatsApp, appointment requests, and asynchronous business follow-up on eligible plans.

The existing organization/membership/session system, website subscriptions and upgrades, website publishing, custom-site CMS, bookings/customers/services, partner-client grants, team permissions, email renderer, push preferences, daily cron and NEW badge registry are reused. The clinical AI receptionist remains available through its existing engine. The general website chatbot uses the same server-only DeepSeek transport, without clinical tools or access to billing/admin functions. There is no separate chatbot checkout, customer wallet or backend per business.

The shared website-pricing catalogue in Main and Business describes the new inclusion. Plan IDs and every existing monthly/annual price remain unchanged.

## Database

Additive migration `066_ai_chatbot.sql` creates the general-product configuration, entitlements, bots, knowledge, verified domains, short-lived installation proofs, sessions/messages, leads, notification outbox, monthly usage, daily spending, per-request reservations, rate limits, org-specific caps and audit records. It registers the product with NEW badges and adds the explicit `MANAGE_CHATBOT` partner scope.

SQL functions serialize creation, knowledge limits, selected builder installation and AI usage/spend reservations. Composite organization/bot/session keys prevent mismatched tenant records. Financial usage/reservations survive conversation deletion; conversation content and enquiries are deleted together. Appointment customer/booking records remain subject to the existing booking workflow and its retention policy.

Migration defaults preserve subsequent administrator edits on replay. Historic scope-check migrations 040/059 accept the new scope so deployment replay does not reject legitimate grants. The existing prebuild includes 066; `npm run db:migrate` also picks it up. Migration 066 has been applied to the configured workspace database. This does not prove an independently configured deployment uses that same database.

## Public routes and installation

- `GET /chatbots/widget.js`: small JavaScript launcher, closed shadow root, isolated iframe. Successful deployment verification requires `X-JKTL-Widget: 1`.
- `GET /chatbots/widget/[id]`: public iframe, noindex, safe text rendering.
- `GET /chatbots/c/[slug]`: standalone chat, noindex, unique public slug, protected against embedding as a substitute for the domain-authorized widget.
- `POST|OPTIONS /api/chatbots/[id]/embed`: exact allowed-origin checks and one-use, expiring connection proof.
- `POST /api/chatbots/session`: consume proof; create/resume a matching bot/origin session.
- `POST /api/chatbots/messages`: bearer-session history.
- `POST /api/chatbots/send`: streamed SSE messages.
- `POST /api/chatbots/lead`: consent-validated, idempotent enquiry/handoff/appointment request.

Owner/partner/admin mutations use existing authenticated Next.js server actions, not public widget credentials. Public IDs are identifiers, never private-management credentials. Public APIs do not accept organization IDs as authorization.

Installation uses the actual Business deployment by default:

```html
<script
  src="https://business.jktl.com.ng/chatbots/widget.js"
  data-chatbot-id="YOUR_PUBLIC_ID"
  async
></script>
```

Dashboard code remains hidden until the configured deployment serves the expected widget marker. External and Custom customers register the exact hostname, publish `_jktl-chatbot.HOSTNAME` TXT with the generated value, and verify it using public DNS. Verification lasts 30 days and can be removed immediately; wildcard origins are not authorized. Apex and `www` are separate hostnames. A public browser script cannot keep secrets; server rate/budget controls remain necessary even on verified domains.

Builder customers select **Enable on my JKTL website**. Existing public publishing renders that assistant on the organization's published tenant/custom domain. Selecting another assistant replaces the previous builder assistant atomically. It replaces the legacy launcher on that site, avoiding duplicate chat widgets.

Standalone links, e.g. `https://business.jktl.com.ng/chatbots/c/business-slug`, work without signup. The same engine, facts, limits and retention apply everywhere. External iframe history restoration requires a fresh proof and an exact match to the original embedding origin.

## Plans and administration

| Existing subscription           | Bots | Completed AI replies per UTC calendar month | Knowledge entries | Conversation retention | Additional features                                                                   |
| ------------------------------- | ---: | ------------------------------------------: | ----------------: | ---------------------: | ------------------------------------------------------------------------------------- |
| Free                            |    1 |                                         100 |                20 |                 7 days | Basic leads/branding/analytics, WhatsApp, external embed, standalone link             |
| Starter (existing ₦5,000/month) |    1 |                                         500 |                50 |                30 days | Appointment requests, optional marketing-consent capture, standard branding/analytics |
| Growth, Business, Elite         |    5 |                                       3,000 |               500 |                90 days | Team inbox/follow-up replies, advanced analytics/branding, optional branding removal  |

All these entitlements are centralized and editable at `/admin/chatbot`. The actual currently paid subscription period controls the tier; after expiry it falls back to Free. Downgrade limits affect public bot eligibility and current knowledge/retention immediately. Disable an older assistant to make another eligible within a smaller bot allowance.

Team capability `manage_chatbots` is required for configuration, aggregate costs/errors, suspension and customer support review. Owner has it; ordinary roles do not receive private-conversation access automatically. Review requires a recorded support purpose. Existing team permission overrides can authorize an appropriate role. NEW badges are managed independently in the existing Features section.

The dashboard reports real retained conversations, lifetime aggregate conversation/lead/handoff counters, completed usage, remaining allowance, and eligible plan-specific trends/common questions. Internal administration shows token-based cost estimates, unresolved reservations, technical errors, and real 24-hour anomaly thresholds (over 1,000 turns or at least five uncertain calls per bot).

## AI availability, usage and cost controls

**Live AI starts disabled.** With no configured/verified provider, only approved knowledge/FAQs and contact/handoff flows operate. The public UI states this explicitly. No model ID or token price is assumed.

Counts reset on the first of each **UTC calendar month**, independently of subscription payment dates. Only completed AI responses consume response allowances. Exact FAQs, knowledge fallback and human messages do not. There are no automatic overage charges.

Concurrent requests reserve both response capacity and conservative inference cost before contacting the provider. Replayed request IDs cannot double-generate or double-count. Organization/month, global/day and per-session locks use a consistent order. Limits include message length, context length, output length/tokens, session turns, per-visitor/per-bot rate limits, organization spending and a global daily cost cap. The starting internal budget caps are administrator-editable, separate from customer billing: Free USD1/month, Starter USD5/month, higher tiers USD20/month, global USD100/day.

Actual provider token counts are recorded when available, multiplied by the verified rates at generation time. These are **cost estimates**, not a provider invoice; input-cache discounts are conservatively not deducted. Missing token reports and interrupted/ambiguous calls retain worst-case reservations rather than being reported as free. They are never blindly retried. An unexpected cost above its reservation disables generation for operator review. Admin can disable AI during outages or stop an abusive bot independently. Approved facts/contact options continue when AI budget is exhausted.

Daily cron enforces current retention, expires proofs/rates, marks stale requests uncertain and retries queued notifications. Request-time access also enforces expiry/current retention, so privacy does not rely on cron punctuality. Cron uses the existing hosting schedule; it does not add a prohibited high-frequency job.

## Knowledge, leads, appointments and partner access

Owners enter business facts and approved FAQs. Optional synchronization reads currently published structured builder content/services or a selected authorized LIVE managed-CMS project's published text. Changes take effect on subsequent queries; drafts and arbitrary external websites are not scraped. Retrieval is bounded lexical search, with exact FAQ answers avoiding AI entirely. Retrieved content and visitor text are treated as untrusted data; the model has no action/SQL tools. Output renders as text, not arbitrary HTML.

Contact requests need explicit business-follow-up consent. Marketing opt-in is separate, optional and available only when entitled. WhatsApp opens the configured business number without putting transcripts in a URL. Higher-tier inbox replies are asynchronous; the UI does not promise an available live agent. Lead notifications reuse existing branded email and push channels, with a durable per-channel outbox. No new inbox/provider is created.

Paid appointment requests validate an active service in the same organization and a future WAT date/time, then create a real **pending** booking/customer through existing tables. A request is never represented as a confirmed appointment.

`/partners/chatbot` lists only clients with an explicit active `MANAGE_CHATBOT` grant. Every server action rechecks approved partner status, client authorization and central product permissions. The client's actual plan applies. Existing partner support remains available. A public bot ID or another client's org ID grants no management access.

## Environment and go-live

Use existing secure deployment environment settings:

- `DATABASE_URL`: existing Business database.
- `DEEPSEEK_API_KEY`: existing shared AI provider key, server-only.
- `DEEPSEEK_BASE_URL`: optional existing provider base override; leave unset for DeepSeek's official API.
- `CHATBOT_PUBLIC_ORIGIN`: optional, default `https://business.jktl.com.ng`. Must point to the same running application. Local HTTP origins are accepted only in development.
- Existing `RESEND_API_KEY`, verified sender/reply-to settings and push/VAPID configuration enable their existing notification channels. They are not needed for FAQ-only chat.

After deployment, confirm widget JavaScript returns HTTP200 and its marker, then create a bot, approve facts, configure contacts, verify an external hostname or enable builder installation. To enable AI, add the provider key securely, enter a currently supported model ID and its verified USD/million input/output rates in `/admin/chatbot`, choose budgets, mark the model verified, then enable generation.

`chat.jktl.com.ng` is optional and **has not been provisioned by this implementation**. If desired, attach that domain to the same deployment, configure DNS/TLS, set `CHATBOT_PUBLIC_ORIGIN=https://chat.jktl.com.ng`, redeploy, and verify `/chatbots/widget.js`. No separate backend is needed and no unverified URL is advertised.

Live provider responses, external DNS ownership for a real customer and actual notification delivery require configured deployment credentials/domains and controlled operator checks. Automated tests use mock providers and temporary isolated records; they do not send real emails or spend AI credits.

## Verification record

Automated tests cover the full PostgreSQL migration history, plan mapping/expiry/downgrade, bot/knowledge limits, tenant isolation, concurrent reservation/quota enforcement, idempotency, ambiguous charges, actual/mock token accounting, streamed provider failures, no-key/FAQ fallback, one-use installation proofs, consent, leads, pending bookings, domain revocation, current retention, rate limits, partner grants/revocation and deterministic builder selection. Existing template rendering and pricing parity regressions are checked too.

Opt-in `tests/chatbot.browser.cjs` exercises real server actions and public HTTP flows using isolated temporary database identities, removes those fixtures afterward and saves desktop/mobile screenshots under `/workspace/exports`. It requires a development server at localhost:3155, the same secure database binding, `CHATBOT_PUBLIC_ORIGIN=http://localhost:3155`, and explicit `CHATBOT_BROWSER_TEST=1`. It does not alter existing customer records.

Final local verification: all 59 test files passed in the complete regression run; the focused chatbot suite passed 14 checks. Business and Main production builds passed, Business TypeScript passed, and lint passed for changed files. Repository-wide lint still reports pre-existing errors in the unrelated partner-domain component and older CommonJS browser fixtures. Chromium passed dashboard creation/editing, standalone FAQ/history, consent/lead capture, WhatsApp URL, desktop/tablet/mobile overflow checks, external widget close/reopen, third-party-storage denial, unauthorized-origin HTTP403 and admin rendering. No live AI calls or real emails were sent. Screenshots are saved in `/workspace/exports/chatbot-*.png`.
