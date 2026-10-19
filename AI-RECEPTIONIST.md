# JKTL AI Booking Agent & Missed-Call Revenue Recovery

Implementation notes, operating runbook, and the commercial model — for the
three verticals this was built for: **men's health**, **aesthetics & beauty**,
and **elderly & home care**.

The intercept pipeline turns an unanswered call into a booked appointment
without a human touching it, and — the part that matters commercially — it
does so while keeping the clinic's messaging spend out of JKTL's margin.

---

## 1. The pipeline, mapped to this repository

```
Patient calls the clinic's line
        │  (busy / unanswered)
        ▼
Twilio virtual line ── voice webhook ──► POST /v1/missed-call
        │                                   (alias: /api/webhooks/termii/missed-call)
        │                                   src/app/v1/missed-call/route.ts
        │                                   src/lib/ai/voice-webhook.ts
        ▼
JKTL core engine
        │  resolve dialled number → tenant        src/lib/db/receptionist.ts
        │  record the call (idempotent)           createMissedCall
        │  open a chat session                    createChatSession
        │  render the SMS from the vertical's      src/lib/ai/sms.ts
        │  own template
        │  debit the clinic's wallet               chargeWallet  ← the guardrail
        ▼
Twilio SMS API ──► src/lib/termii.ts (sendSms)
        │
        ▼
Patient's handset receives
   "…sorry we missed your call. Book here: jktl.com.ng/chat?id=…"
        │
        ▼
GET /chat?id=<session>&phone=<msisdn>       src/app/chat/page.tsx
        │  loads the session, the clinic, the pack
        │  greets: "Welcome back, Chioma."      src/lib/ai/prompt.ts
        ▼
DeepSeek cognitive layer                    src/lib/deepseek.ts
        │  system prompt + 3 tools              src/lib/ai/engine.ts
        │  book_appointment / handoff_to_human / finish_conversation
        ▼
Booking written with source = 'ai_receptionist'   src/lib/db/bookings.ts
```

Everything above is implemented and wired: the webhook, the wallet, the chat,
the booking, the console, the contract, and the tests.

---

## 1b. The website template's chatbot

Every published site now ships with the AI assistant, not just the SMS link.
`PublicSiteView` renders `src/components/public-site/site-ai-chat.tsx` when the
business has the receptionist switched on, and the scripted decision tree it
replaces when it hasn't — so no business is left with a dead chat button.

What a visitor gets is the same agent a missed caller reaches: same clinical
pack, same deterministic emergency screening before the model, same escalation
to a human. Three things are different on purpose:

- **The entry point is the page itself.** The hero carries an *"Ask our AI
  assistant"* button alongside *Book an appointment*, plus the floating bubble.
- **The conversation opens server-side.** The first turn posts a `subdomain`
  and a token the visitor's own browser holds; the server resolves the
  published site, opens or resumes the thread, and returns its id. A reload
  continues the conversation instead of starting a new one — and one new
  conversation per visitor per hour is the cap that stops a public,
  unauthenticated endpoint being used to run up inference cost.
- **Booking hands off to the site's own form.** A website visitor hasn't given
  a phone number yet, so "Book <service>" prefills and scrolls to the booking
  form rather than writing an appointment nobody can confirm. (The SMS path
  *does* book directly — it already knows the number.)

## 2. The three verticals

Each vertical is a **pack** — `src/lib/ai/industry-packs.ts` — containing the
persona, tone, privacy stance, hard prohibitions, suggested services, booking
policy, and the clinical red flags. Selecting a pack in the console changes
what the agent is allowed to say and when it must stop.

| | Men's health | Aesthetics & beauty | Elderly & home care |
|---|---|---|---|
| **Pack id** | `mens_health` | `aesthetics` | `elderly_care` |
| **Business type** | Men's health clinic | Aesthetics & beauty clinic | Elderly & home care |
| **Stance** | Discretion is the product. Unembarrassed, clinical, never jokey. | Warm, outcome-first, never salesy, never comments on appearance. | Patient, unhurried, respectful; addresses the patient, not just the family. |
| **Emergencies it screens for** | Priapism >4h · chest pain / nitrate interaction · testicular torsion · penile injury · suicidal ideation | Vascular occlusion (vision change, blanching) · anaphylaxis · chemical/laser eye exposure · suicidal ideation | FAST stroke · fall with head injury or on blood thinners · chest pain / breathlessness · new confusion, fever or not drinking (delirium/sepsis) · suicidal ideation |
| **Handed to a human** | Blood in urine/semen + weight loss · urinary symptoms with fever | Signs of infection after a treatment | Medication changes · unsafe home situation |
| **Flagged, chat continues** | Patient under 18 | Pregnancy/breastfeeding · isotretinoin · active infection in the area · body-image distress · under 18 | Isolation |
| **Never says** | Never names a drug or dose · never diagnoses · never promises a prescription · never repeats symptoms into an SMS | Never guarantees a result · never diagnoses · never confirms suitability for injectables/lasers · never quotes a final price pre-consultation | Never advises on medication · never calls a symptom "just old age" · never shares information with an unauthorised family member |

A fourth pack, `general`, covers every other business type on the platform —
the same pipeline, minus clinical screening.

---

## 3. Why the safety decision is not made by the model

**Triage runs before the language model, deterministically.**

`src/lib/ai/triage.ts` screens every inbound message against the pack's fixed
rule list — phrases plus a few regexes for durations and sentence shapes — and
its result *overrides* whatever the model wanted to do. If a patient writes
anything matching a priapism, stroke or vascular-occlusion rule, the model is
never called for that turn: the fixed response goes out, the clinician is
alerted by push and email, and the session is closed to further booking.

That ordering is the design, not an implementation detail:

- **A clinic's medical director cannot sign off on a probability.** They can
  review a list of phrases. The stack of rules is a document, and the console
  renders it in plain language.
- **Safety must not depend on an API being up.** The screen runs locally; if
  DeepSeek is unreachable the escalation still fires.
- **The behaviour is pinned by tests.** 53 tests in `tests/ai-core.test.mjs`
  assert, among other things, that each clinical pack has at least three
  emergency rules, that every emergency response contains the emergency number
  (112), that no emergency response tells a patient to wait for a callback,
  and that **no pack's SMS body leaks the reason for the call** — the men's
  health callback text is asserted not to contain the words *erection*,
  *testosterone*, *STI*, *fertility*, *dysfunction* or *sexual*.

Negation is handled per rule, so "no chest pain" does not fire — while "no
chest pain, but she can't breathe" still escalates the breathing.

---

## 4. The money

All of it lives in one dependency-free module, `src/lib/ai/pricing.ts`, and is
rendered in three places that must never disagree: the ROI tab in the console,
the proposal, and the tests.

### The contract

The ₦650,000 turnkey package is **not** charged upfront. It is billed as six
monthly instalments, then the platform tier takes over:

| Months | Charge | What it is |
|---|---|---|
| **1–6** | **₦108,333.33/month** | The ₦650,000 package, amortised (`650,000 ÷ 6`) |
| **7 onward** | **₦59,000/month** | Platform tier: assistant, dashboard, model updates, live sync |
| **At activation** | ₦15,000 **free** communication credit | Granted first, and spent before any paid balance |
| **Messaging** | Pay-as-you-go from the clinic's own wallet | Immediately, separate from the above |
| **Cancellation** | **Any time from month 1** | No minimum term, no early-exit fee |

Two details that matter more than they look:

- **The instalments sum to exactly ₦650,000.** `650,000 ÷ 6` is ₦108,333.33⅓, and
  six payments of ₦108,333 would lose 2 kobo against the contract. `amortize()`
  in `src/lib/ai/pricing.ts` puts the odd kobo on the earliest instalments —
  the first two are ₦108,333.34 — so a customer's records never show an
  unexplained gap. Asserted for every total and month-count the product can
  produce, not just this one.

- **"Cancel anytime" is a real concession, and it is priced.** The instalments
  pay for work already delivered (line provisioning, data cleaning, calendar
  sync, triage rule ingestion), so cancelling in month 2 collects a sixth of
  the package and the remaining ₦541,666 is simply never billed.
  `cancellationSummary()` quantifies it and the console shows it on the
  contract card: *"Cancelling today would collect ₦21,666.67 of the ₦650,000
  package, and the remaining ₦628,333.33 would never be billed."* Nobody
  should have to discover that in a spreadsheet.

The schedule itself lives in one place — `contractSchedule()`,
`amountForMonth()`, `platformPhaseStart()` — and drives the console's "Pay
₦X" button, the weekly reminder email and the invoice amount, so those three
cannot disagree. `amountDueNow()` reads it server-side, so a client cannot ask
to be charged a different figure.

This also changes the ROI arithmetic, and the console says so rather than
quoting the friendlier number: during the instalment phase a clinic needs
**five** ₦25,000 consultations a month to break even, dropping to **three**
once the ₦59,000 tier starts.

### Free credits first, then top up

Every business is granted **₦15,000 of free communication credit** when it
activates the receptionist — roughly 3,300 callback SMS at the unit cost.

The ledger keeps the free and paid buckets apart on every row
(`free_amount_kobo` + `paid_amount_kobo`, with a CHECK that they always sum to
`amount_kobo`, so the balance invariant is untouched). `chargeWallet` spends
the free bucket **first**, in the same atomic statement as the sufficiency
check. So:

- the clinic watches its free allocation being used, and the wallet panel says
  exactly how many messages are left on it;
- nothing is billed until the free credit is gone;
- only then does the guardrail start holding callbacks back and asking for
  money — `free_exhausted` switches that messaging exactly once, rather than
  nagging from day one.

A `grant` is recorded as a distinct ledger kind from a `topup`, so a free
allocation never counts as revenue.

### The communication wallet is the margin guardrail

`comm_wallet_transactions` is an append-only ledger; the balance is
`SUM(amount_kobo)` and is never a stored counter. `chargeWallet()` performs
the sufficiency check and the debit **in one statement**, so two simultaneous
webhooks cannot both pass a check only one of them can afford. When the money
isn't there:

1. nothing is sent — the platform never carries a clinic's traffic cost;
2. the call is recorded as `sms_blocked` with the reason;
3. the console shows it and the weekly cron chases it.

A failed Twilio send refunds the debit automatically. A successful send can
never be double-charged (the ledger's `(provider, provider_ref)` uniqueness),
and a *failed* one can be retried — idempotency here means "never text the
same patient twice about the same call", not "never try again".

### Margin, stated honestly

At DeepSeek's published token prices and an assumed ₦1,600/$, a 12-turn
booking conversation costs roughly **₦5–₦10** (cache hits are what keep it
there — the system prompt is byte-stable so DeepSeek's context cache serves
most input tokens at the cheap rate).

- Gross margin on the ₦59,000 tier at 10/50/100/260 conversations a month:
  **above 95%** in every case (tested).
- `sessionsAtMargin()` states the ceiling: the volume at which inference would
  eat 5% of the subscription. It is in the hundreds of conversations per
  month — far beyond a single front desk, but it is a real number rather than
  an unbounded claim.

SMS and WhatsApp are **not** in that cost, by design: they are deducted from
the clinic's own wallet and are a pure pass-through, which is the entire point
of the guardrail.

**Not yet in the model: the per-tenant phone line.** Routing an inbound call
requires a dedicated virtual number per business (the dialled number is the
only signal in a voice webhook), and that DID is a recurring cost JKTL pays.
`subscriptionEconomics({ lineRentalKobo })` now takes it, defaulting to 0
because the commercial treatment is still an open decision — and it is the
biggest single threat to the 95% claim:

| Line rental/month | Total cost/month | Gross margin |
|---|---|---|
| ₦0 | ₦893 | 98.5% |
| ₦2,000 | ₦2,893 | 95.1% |
| ₦10,000 | ₦10,893 | 81.5% |
| ₦25,000 | ₦25,893 | 56.1% |

The 95% figure only survives a line rental under about ₦2,057/month. Either
price it into the tier or bill it to the clinic's wallet as a pass-through
like messaging; until one is chosen, quote the margin with the real quoted
line cost passed in.

---

## 5. The pitch, per vertical

The calculator is in the console's **Return on investment** tab and uses the
same arithmetic the proposal quotes. Defaults: 3 missed calls/day, ₦25,000
average consultation, 20% recovery — **₦75,000 lost per day and ₦195,000 per
month**, against a break-even of **5 recovered patients during the instalment
phase** and **3 once the ₦59,000 tier starts**. The tab compares against
whatever the clinic is actually paying that month.

What differs by vertical is which number the director cares about:

- **Men's health.** The constraint is not demand, it is *discretion*. A man
  who calls about erectile dysfunction and reaches a busy line rarely calls
  back — he books elsewhere, or nowhere. The callback SMS reveals nothing
  about why he called, and the chat opens confidentially on his own phone.
  Your highest-intent, most easily-lost enquiries are exactly the ones this
  catches.
- **Aesthetics & beauty.** The constraint is *responsiveness*. Beauty demand is
  impulsive and comparison-shopped: a missed call during a treatment is a
  client booking with the next clinic on Instagram. The agent answers in
  seconds, quotes real prices, and books consultations — while the suitability
  screening quietly protects you from treating the wrong person.
- **Elderly & home care.** The constraint is *trust and triage*. The person
  calling is often an adult child arranging care from another city, and the
  calls you must never mishandle are the emergencies — a fall on warfarin, new
  confusion, a face drooping. The agent books visits around the clock and
  escalates red flags to a human immediately, with the patient told to seek
  emergency care rather than wait.

---

## 6. Operating runbook

### 6.1 Deploy the schema

```bash
npm run db:migrate          # applies migrations/016_ai_receptionist.sql
```

Idempotent — every statement is `IF NOT EXISTS`-guarded, so re-running the
migration script is safe.

### 6.2 Required environment variables

Copy `.env.example` and set:

| Variable | Why |
|---|---|
| `TWILIO_API_KEY` | Sends the callback SMS. Without it, calls are recorded and nothing is sent. |
| `TWILIO_WEBHOOK_SECRET` | **Required in production.** The webhook refuses unauthenticated requests rather than spending a clinic's money. |
| `TWILIO_DEFAULT_SENDER_ID` | Sender ID if a business hasn't set its own (must be approved by Twilio). |
| `DEEPSEEK_API_KEY` | Without it the assistant falls back to the scripted agent — still useful, just not conversational. |
| `PAYSTACK_SECRET_KEY` | Setup fee and wallet top-ups. |
| `CRON_SECRET` | Lets the weekly sweep run. |
| `NEXT_PUBLIC_APP_URL` | Builds the `https://…/chat?id=…` links. |

### 6.3 Point Twilio at the endpoint

Register the voice webhook in Twilio as:

```
https://<your-domain>/v1/missed-call?key=<TWILIO_WEBHOOK_SECRET>
```

`GET` on that URL reports whether the Twilio key and webhook secret are
configured, which makes it easy to confirm the deployment is reachable:

```bash
curl https://<your-domain>/v1/missed-call
```

### 6.4 Onboard a clinic

1. Create the account and pick the business type (men's health / aesthetics /
   elderly care) — that selects the default clinical pack.
2. **Settings → Business**: set the phone and email; these become the default
   escalation contacts.
3. **More → AI receptionist → Settings**: set the clinic line (the Twilio
   virtual number), the SMS sender ID, and confirm the pack.
4. **Test it** on the same screen: the test button runs the *real* pipeline
   against the clinic's own line and sends a real message to a real number.
   This is the demo that closes the sale — have the medical director watch
   their own phone receive the callback.
5. Collect the ₦650,000 setup fee (button in the **Wallet** tab, or record a
   bank transfer). The included credit lands in the wallet immediately.
6. Switch on **Answer missed calls**.

### 6.5 What to watch

- **Wallet low** → the weekly cron emails and pushes; the console shows a red
  banner and the number of callback messages the balance still covers.
- **Escalations** → push notification and email the moment a red flag fires,
  naming the rule and the patient's number (never the patient's words — that
  stays in the console, behind a login).
- **Recovery rate** → the console's Return on investment tab shows observed
  figures against the projection.

### 6.6 Cron

`vercel.json` registers `/api/cron/receptionist` weekly (Mondays 07:00 UTC). It
is deliberately weekly rather than daily: neither a low balance nor a due fee
has a per-day idempotency key, and a daily repeat would train clinics to
ignore the alert. Collection itself reuses the existing Paystack subscription
machinery — the job reminds, it does not charge.

---

## 7. What is verified, and what needs credentials

**Verified in this repository** — `npm test`, `npx tsc --noEmit`, `npx eslint`
and `npx next build` are all clean, and 150 tests pass across the three suites:

**61 unit tests** (`tests/ai-core.test.mjs`) over the pure core: pricing and ROI
arithmetic, the margin claim and its volume ceiling, pack integrity, triage
screening (including negation, severity ordering and malformed patterns), SMS
rendering and per-segment billing, prompt construction, and the
emergency/guardrail invariants.

**42 schema tests** (`tests/schema.test.mjs`) that apply **every migration to a
real Postgres** — compiled to WebAssembly via `@electric-sql/pglite`, so this
exercises the actual engine rather than a mock — and then assert the guarantees
the feature depends on:

- all 16 migrations apply in order, and are safely re-runnable (the migration
  script re-applies every file on each deploy);
- a clinic line resolves from `+234…`, `0700…` or a spaced form, and one line
  can never belong to two businesses;
- a replayed Twilio webhook cannot text a patient twice;
- the wallet's single-statement guardrail refuses an unfunded send, holds at
  exactly zero, and cannot double-charge on a provider retry;
- the balance equals `SUM(ledger)` and the reporting view agrees;
- inference cost cannot be pushed into a clinic's wallet, and an unexplained
  ledger adjustment is rejected;
- recovered revenue is one indexed query;
- the contract is a six-instalment schedule rather than an upfront fee, a
  month can only be paid once, and cancelling stops future charges;
- a website visitor resumes their own conversation and nobody else's.

**Two real defects were found by that schema suite during development**, both
of which would have shipped otherwise:

1. **A unary minus on an untyped SQL parameter.** `SELECT …, -${amount}`
   compiles to `-$1`, and Postgres refuses to resolve unary minus on an
   untyped parameter (`operator is not unique: - unknown`). This would have
   thrown on the first wallet charge in production. Fixed by casting:
   `(- ($1)::bigint)`.
2. **Line uniqueness enforced on the raw string.** Two businesses could
   register the same number as `0700 000 1234` and `07000001234`. Since
   inbound routing normalises to the last nine digits, one of them would
   silently receive the other's calls and text the wrong clinic's patients.
   Fixed with a generated `voice_number_key` column and a unique index on it.

**Not verifiable without live credentials** (by design — no keys are
committed):

- A real Twilio SMS send and the exact shape of their voice webhook payload.
  `parseVoiceWebhook` in `src/lib/termii.ts` is deliberately tolerant of the
  field-name variations across Twilio's voice products and reports what it
  could not find, so an unexpected payload shows up as a logged warning rather
  than a silently dropped call.
- DeepSeek completions and real token accounting (`prompt_cache_hit_tokens`).
  The cache-aware cost path is implemented and unit-tested against the
  published rates; only the live numbers are unverified.
- Paystack checkout for the setup fee and top-ups.

---

## 8. Deliberate limitations

- **WhatsApp is scaffolded, not built.** The schema has the channel and the
  ledger has the transaction kind, but only SMS sends today.
- **Monthly payments collect themselves.** The card captured by the first
  payment is charged automatically each month, with a per-month lock that makes a
  double charge impossible. See **[BILLING.md](BILLING.md)** for the mechanism,
  the failure handling, and where a clinic sees it.
- **Voice transcription of a voicemail is not included.** The blueprint's
  pipeline is missed-call → SMS → chat; if Twilio's plan returns a recording,
  feeding it into the first chat turn is the natural next step.
- **The scripted fallback cannot book.** It answers from real data and hands
  off to a human; quick-reply bookings and the model path are what write
  appointments. This is stated in the console rather than hidden.
