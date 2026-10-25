# JKTL customer care: operations and launch guide

## What this release adds

An owner can create a **Support** team account at Admin → Team. This is a predefined restricted role in the existing admin authentication system, not a separate login or a business-owner impersonation feature. A support operator signs in at `/admin/login` and lands in `/admin/support`. Owners also have that inbox. Editors and owners can moderate customer reviews at `/admin/reviews`; Support cannot publish testimonials.

Customers use `/business/help`. The live account has conversations, a guide assistant, human handoff, limited website-assistance permissions and feedback history. Demo users can read guides but cannot write production cases or authorize operations. The existing business-tool FAQ content and home-screen installation instructions are included in the expanded help library; the WhatsApp contact path remains available.

The canonical library is `src/lib/support/knowledge.ts`. It combines 18 long-form product walkthroughs with the existing operational business FAQs. Search covers titles, summaries and tags. Each article contains precise steps, troubleshooting and escalation guidance. The same content is mirrored in Main `lib/support-knowledge.ts`, used by the public Help Centre and marketing guide chatbot. Update both copies together. Do not place confidential provider instructions, access keys or customer records in this public library.

## Create and onboard a Support operator

1. Sign in with an existing Owner account. Open Team. Choose Support in the role selector, then supply the colleague’s real name, email and a unique strong temporary password through the existing account-creation form.
2. Share the initial credential through your established secure colleague process. The application does not email a reusable password. Do not post it in a support case.
3. Have the colleague sign in at `/admin/login`. Verify the only application navigation available to this role is Support inbox. It must not expose businesses, finance, team accounts, domain administration, email provisioning, lead tools or review moderation.
4. Open Support inbox and read the installation card. Use Install Support app if the browser offers installation; otherwise follow the iPhone/Android/desktop instructions. The support-specific manifest opens `/admin/support` from the home-screen icon.
5. Open the installed app and select Enable support alerts. Grant browser permission voluntarily. On iPhone/iPad, use a supported iOS version, Safari and the installed home-screen app. Installation is not the same as granting notification permission.
6. Confirm the device is registered. If configuration or browser support is unavailable, keep the inbox open and refresh it; never assume alerts are being delivered merely because the PWA was installed.
7. Use a permitted test customer account to request human help. The staff device should receive a generic inbox notification. It must not include the customer’s message, password, invoice details or payment reference.
8. When a colleague leaves, disable their admin account through Team. Sessions are invalidated by the existing identity system. Support push delivery joins the current admin role, disabled state and unexpired session; subscriptions are also bound to the originating session. Sign-out/session deletion removes the staff device registration through its foreign key.

## A routine support case, from first message to resolution

1. The customer opens Help & support in their live business. Ask for the screen name, intended task, actual error and what they already tried. Do not request screenshots containing private customer records. A public website URL and non-secret order reference are usually enough for navigation guidance.
2. The assistant retrieves relevant guides. With `DEEPSEEK_API_KEY` configured, it can phrase a grounded answer using those guides. Without a model or during a provider failure, the guide assistant still gives deterministic instructions and links. This is separate from a business’s paid customer-facing AI receptionist.
3. The support assistant has no account mutation tools. It is never evidence that a domain is available, a payment succeeded, a refund was approved, a mailbox was created or an account was changed. Check the authoritative product workflow.
4. The customer can choose Talk to a person at any point. The same transcript becomes a waiting case. Automated replies stop after handoff, including an AI result that was still in flight when the human request was recorded.
5. Open the queue and claim a waiting case. Assignment is exclusive. A second agent must not steal it. Owners can take over an active case when higher authority is needed or an assigned colleague is unavailable; takeover clears existing assistance permissions and is audited.
6. Read the transcript and guide references. A claim grants access to the support conversation, not arbitrary customer records. Ask a focused clarifying question instead of asking the customer to repeat everything.
7. Reply with the next concrete step and expected result. Explain whether you are guiding the customer, preparing an unpublished draft with permission, or waiting for an administrator. Do not imply that an unperformed action happened.
8. Use Internal note for operational context that should not appear in the customer conversation. Keep notes professional and minimal. They remain separate from public replies and are never included in the customer response payload.
9. If the customer needs a sensitive operation, use Escalate to administrator with a brief factual reason. Escalation clears website permission, releases assignment and moves the case to the owner-only queue. Do not change the request category to get around a denied action.
10. Resolve only after describing the actual result and any remaining customer step. Resolving clears active assistance permission. Further help can start a new case; a resolved case does not keep a standing account-access grant.

## Assistance permissions and website publishing

Support has two optional, customer-controlled scopes: viewing/editing an **unpublished website draft**, and publishing the **first free website**. The active business owner must grant the relevant scopes in their own case. An employee can ask for guidance but cannot authorize owner-level operations; ask the owner to start their own conversation if necessary.

A grant lasts 24 hours, is limited to one business and case, and can be revoked immediately. The server checks active owner membership, assigned agent, case state, sensitivity, scope, expiry and current website revision for every write. Access is not based on a role label or a hidden button alone. Draft data is omitted after permission expires or is revoked; Support’s audit view also omits the historical document snapshots so audit history cannot bypass revoked access. Owners retain the detailed audit record.

To assist with a first website:

1. Claim the customer’s waiting case. Confirm the business name and that it is the right account.
2. Ask the owner to select the draft-assistance checkbox and save permissions. Explain exactly what you propose to change. If publishing is requested, they must separately authorize first publication.
3. Load the current draft. The tool shows the current template and revision. Keep the existing selected design. If there is no design yet, choose the industry design the customer requested and prepare its starting content.
4. Edit the normal content fields: business name, home headline, introductory copy, About text, image URLs, services, service areas, contact copy and search metadata. Use images the customer is allowed to publish. Do not create fabricated reviews or invented service prices.
5. Read the proposed text back to the customer or have them review it through their editor. The permission is not a licence to invent their business identity.
6. Save the authorized draft. The server validates the complete website document using the existing template parser. It will reject unsupported images/links, invalid content, a replaced template, a stale revision, missing permission or a website already published.
7. If the customer edits simultaneously, stop on a revision conflict. Reload the current draft and reconcile the differences; never force a stale revision through.
8. Publish only with the separate publication grant, an unpublished current site and reviewed content. This publishes to the existing free JKTL address. It does not buy a domain, change a website plan or provision hosting/email under another contract.
9. Ask the customer to open the live JKTL address, check both desktop/mobile behavior and confirm their contact information. Revoke assistance or resolve the case when complete.

The intentionally narrower first-release support tool does not edit an already published site or replace a chosen template. For those cases, guide the owner through their own editor or escalate. It does not start a customer session, request a password, change profile identity/contact ownership or touch private customer records.

## Escalation matrix

| Request | Routine Support response | Higher-authority operation |
| --- | --- | --- |
| Free template selection / first draft | Explain preview/Edit; edit unpublished content with current grant | Published-site replacement or destructive recovery |
| Domain availability | Explain confirmed status and where the customer checks their request | Confirm quotes/availability, registration, registrant/ownership, transfer, destructive DNS |
| Business Email | Explain plans, TXT verification, status and secure activation links | Paid licence/provisioning, MX/SPF/DKIM/DMARC changes, migration, mailbox deletion, provider reset |
| Secure payment | Explain the product, amount/period shown and how the owner opens checkout | Debit authorization, changing amount, recording provider success, ledger correction, refunds |
| Website-plan guarantee | Explain the published eligibility terms and collect the reference | Decide or execute a refund; handle a chargeback |
| Access / compromise | Point to the secure portal/reset flow; protect the transcript | Change email/ownership, verify identity, recover a compromised account, delete data |
| Private records / finances | Explain normal tools without exporting records | Membership changes, private customer data, bulk/irreversible changes or financial adjustments |
| Review / testimonial | Show the feedback and withdrawal flow | Publish/unpublish with current consent; privacy dispute review |

Sensitive phrases are screened and routed conservatively, but classification is not an authorization mechanism. Even a misclassified case cannot give Support a payment, credential, provisioning or ownership capability. Existing owner-only services retain their own role guards.

## Notification operation and retry

The staff application reuses the existing service worker and Web Push setup. Required environment variables are `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and optionally `VAPID_SUBJECT`. Register devices only through a user’s Enable support alerts action. Browser notifications can be denied or unavailable; do not repeatedly trigger permission prompts.

New handoffs and customer messages to a human case enqueue generic staff notices. Escalations notify owners only. Replies enqueue generic customer notices and respect the business’s existing push master preference. Staff subscriptions are checked against current active roles and sessions at send time. Endpoints must use supported HTTPS push providers; arbitrary URLs and malformed keys are rejected.

Delivery is attempted after the originating server action, with a durable outbox, five-minute leases and a bounded ten-attempt retry policy. The existing domains maintenance cron retries the queue, and the inbox has a manual Retry queued alerts control. This deployment’s cron currently runs daily, so background retry latency can be a day unless the host’s scheduler is configured for more frequent authorized calls. Immediate attempts still happen after handoff/reply. Do not promise real-time delivery in every browser. Expired provider endpoints are pruned; transient failures remain queued. The inbox polls every 15 seconds and remains the source of truth.

## Feedback and genuine customer proof

The owner can submit feedback directly in Help & support. A compact invitation appears after website publication, a paid and active first domain registration, or seven days of account age. Showing an invitation is recorded, so it is not repeated on every visit. Dismissal suppresses invitations for 45 days, and submission suppresses them for 90 days. A database submission window enforces one submission per 90 days even for concurrent requests.

Every rating is saved, including negative feedback. Publication consent is optional and separate from submission. Consent covers the exact text, rating, display name and business name. The moderation UI has no text-rewrite control. Support cannot publish reviews. Owners/editors can select consented submissions, keep them private or unpublish them. A withdrawn review cannot be republished; the customer can withdraw from their own feedback history.

Main consumes only currently published, consented records through a safe public projection and its own `/api/reviews` proxy. Public cards say **Selected customer reviews**, with no invented aggregate rating. Domain/website labels come from actual account state at submission, not an admin’s claim. Do not describe the curated collection as all customer opinions or trade assistance/refunds for positive feedback.

Domains and Pricing also show real portfolio case studies, using client-approved screenshots already supplied. They do not claim those clients bought a particular plan/domain through a new flow. As actual template users and first-domain buyers opt into reviews, their genuine product experiences appear in the corresponding proof sections after moderation. Do not generate fictional product-adoption stories while waiting for real users.

## Deployment, routes and verification

Apply additive migration `037_support_reviews.sql`. Prebuild includes it. Migration 033’s role constraint was made forward-compatible so replaying the project’s existing migration runner does not reject Support accounts before reaching 037. No password/session format is changed. Existing `DATABASE_URL`, DeepSeek and VAPID variables are reused. No additional public secret or new authentication provider is required.

Customer: `/business/help`. Operator: `/admin/support`. Reviews: `/admin/reviews`. Support manifest: `/admin/support/manifest.webmanifest`. Public guides: `/api/public/help`. Public reviews: `/api/public/reviews`. Main Help Centre: `/resources/help-centre`. Main review proxy: `/api/reviews`.

Before launch, use test identities and a permitted unpublished business. Verify role creation and redirect, AI/guide fallback, human takeover, sensitive escalation, permission grant/revoke/expiry, stale revisions, template retention, first publication, feedback privacy/moderation/withdrawal and notification opt-in. Do not make live purchases, provision mailboxes or send real notification tests to customer devices as part of automated testing.

Automated coverage uses PGlite to run the actual migration and SQL with mocked AI, push and framework request helpers. It checks tenant/role isolation, concurrent claims, expired/revoked permissions, audit privacy, first publication, model/handoff races, review consent/withdrawal/concurrent submissions, push SSRF controls, session revocation and retry behavior. Production builds, TypeScript, lint and responsive browser checks supplement it. Passing local checks do not establish production DB migration, provider readiness or actual device delivery.
