# Money In, Money Out

Everything in JKTL Business that touches money: what the platform charges a
business, what a business charges its customers, and the notifications that tell
each of them it happened.

The principle running through all of it: **money should move without anyone
remembering to press a button, and every movement should announce itself.**

---

## 1. What the platform charges a business

### One product. One bill.

**The Website & Hosting plan is no longer sold.** It was ₦5,000–₦50,000 a month
depending on cycle, and it gated three things: team members beyond the owner, a
custom domain, and storage past the free allowance. Selling that alongside a
₦650,000 receptionist produced the worst moment in the sale: *"the thing you just
bought does not include your second receptionist."*

Everything is included with the AI receptionist now:

| Included with the subscription | Was |
|---|---|
| The assistant, the line, missed-call texts | the receptionist |
| The website and hosting | free tier of Website & Hosting |
| **Team members** (beyond the one free seat) | gated on Website & Hosting |
| **A custom domain** | gated on Website & Hosting |
| **Storage past the free allowance** | gated on Website & Hosting |

`src/lib/db/entitlements.ts` is the single gate. It answers yes for an active
**or past-due** receptionist contract, and yes for a **legacy** Website & Hosting
subscription — because silently revoking features from customers who are still
paying for them is how a chargeback happens. `past_due` counts on purpose: a
failed card is usually an expired card, and locking a clinic out of its own phone
line the day a payment fails turns a recoverable billing issue into a lost
customer.

The four cycles still exist in `src/lib/billing.ts` for existing subscribers'
renewals; nothing in the UI offers them any more.

### The AI receptionist subscription

| Months | Charge |
|---|---|
| 1–6 | **₦108,333.34 / ₦108,333.33** — the ₦650,000 launch package, amortised |
| 7 onward | **₦59,000 / month** |
| Cancellation | **Any time from month 1.** No minimum term, no exit fee |

**It now collects itself.** This is what changed: the contract used to invoice
and remember — the console showed a "Pay month N" button and a weekly email, and
someone had to press it. A clinic will not log in every month to keep its phone
line answering.

### How automatic collection works

```
daily cron (/api/cron/receptionist)
  → contracts that are due, auto-charging, with a card
  → claim the month                    ← the double-charge guard
  → chargeAuthorization (Paystack, card on file)
  → record the payment, advance the schedule, push a receipt
  → on failure: record it, and past-due after three attempts
```

**Claiming the month is the safety property.** `contract_charge_attempts` holds
one row per `(organization, month_index)`, and the claim is an
`INSERT … ON CONFLICT DO UPDATE … WHERE status <> 'charged'`. A retry after a
timeout is allowed because the row is still pending; a second charge for a month
that already cleared finds `status = 'charged'` and matches nothing. Charging the
same month twice is therefore *impossible* rather than unlikely — which matters,
because the two ways this goes wrong (a slow response retried, and two cron
invocations overlapping) both look like success from the outside.

**Nothing is charged without a card.** The manual "Pay month N" button doubles as
card capture: the first payment is made by hand, Paystack returns a reusable
authorization, and the webhook stores it. Every month after that happens on its
own. That avoided building a separate card-capture flow for a payment we were
taking anyway.

**Failures are loud, then quiet.** A declined card is recorded with its error and
retried on the next daily run. On the third failure the contract is marked
`past_due` and one notification goes out — one, not one a day, because a clinic
with a dead card needs a clear message rather than a drip.

### The dedicated phone line — Option A

Each clinic's own number is billed to **its communication wallet**, as a
pass-through cost alongside messaging. Decided, and implemented: see
"Option A" in [AI-RECEPTIONIST.md](AI-RECEPTIONIST.md#the-dedicated-line-is-billed-to-the-clinic-option-a).

The three options that were weighed:

| | Approach | Effect on margin |
|---|---|---|
| **A** | Bill the line to the client's wallet, like SMS | **Untouched** — it is a pass-through |
| B | Bundle it into the subscription | 95% → **81.5%** at a ₦10k line, 56% at ₦25k |
| C | Separate line item on the invoice | Untouched, one more thing to explain |

A was chosen because it matches the guardrail already in place: the clinic pays
for what it uses, JKTL never silently subsidises a number, and the free credit
covers the first months so it does not feel like an upsell on day one.

**The rental is $1.90 per number per month** — Twilio's price, and it is stored
in **dollars**, converted to naira at charge time.

That detail is the whole point under Option A. The rental is a pass-through: the
clinic pays what the number costs. A naira figure fixed on the day the account
opened would quietly become a loss the next time the naira moves, and JKTL would
be absorbing a cost it does not control — the exact subsidy Option A exists to
prevent. Rounding is **up, never down**, because on a pure pass-through there is
no margin to absorb a fraction from.

At ₦1,600/$ that is about **₦3,040 a month**. If the naira moves, the clinic's
wallet charge moves with it, and the console shows both figures so the reason is
never a mystery.

### Where the business sees it

**Settings → Billing** now carries a subscription section
(`src/components/settings/subscription-billing.tsx`) that answers, in order:

1. what am I paying, and for how much longer at this rate;
2. when the next payment is;
3. which card it will come off, or that there isn't one;
4. **whether the last attempt worked** — the line that matters most, because an
   invisible failed charge is how a clinic discovers its phone line stopped
   answering without knowing why.

It also has the automatic-payment switch, a "charge now" button for a card that
has just been fixed, and the full attempt history (month, amount, paid/declined,
how many tries).

The receptionist console shows the same state on the contract card, so it is
visible wherever the clinic happens to be working.

---

## 2. What a business charges its customers

### The invoice is now a document

`/pay/[id]` was a narrow payment widget. It is now an invoice a customer can
forward to whoever approves spending:

- the business's own name, logo, address, phone and email;
- invoice number, issue date, due date, and a status badge (**Awaiting payment /
  Overdue / Paid**);
- who it is billed to;
- line items with quantity, unit price and amount;
- subtotal, discount, processing fee and total;
- **on payment: a receipt state** with the date it settled, and a print button;
- bank-transfer details with the invoice number as the reference, for customers
  who would rather not pay by card.

**Print/Save-as-PDF** works with no PDF pipeline: the page carries print styles,
so the browser's own dialog produces a clean document. Nothing has to be
generated, stored, or kept in sync with the invoice it came from.

### The invoice email matches

`sendInvoiceEmail` now renders the same document in HTML — header, line items,
total, due date (in red when overdue) — with a **"Pay ₦X now"** button linking to
the public invoice. Before, the customer had to read bank details across to their
banking app.

### The receipt

`sendPaymentReceiptEmail` is new and separate from the confirmation email,
because it answers a different question: not *"what do I owe"* but *"did it go
through, and can I prove it"*. It leads with the amount, carries the date and the
Paystack reference — the thing a customer quotes when something goes wrong — and
tells them to keep it.

Both paths that can settle an invoice (the owner tapping "Mark as paid", and a
customer paying online) go through `finalizeInvoicePaid`, so the receipt and the
notifications happen exactly once whichever way the money arrived.

---

## 3. Notifications

### Event notifications

| When | Who hears | Where |
|---|---|---|
| Invoice sent | The business | Push — "Invoice #12 sent, ₦45,000 requested from Ada" |
| **Payment received** | The business | Push — leads with the amount: "₦45,000 received" |
| Invoice paid | The customer | Email receipt |
| Subscription month collected | The business | Push — amount, month, next date |
| Subscription charge failed | The business | Push — amount, and what to do about it |
| New booking, low stock, daily summary | The business | Push (existing) |

The business controls all of it in **Settings → Notifications**, which now has
separate switches for *invoice sent*, *payment received*, and *setup tips &
money advice* — so a clinic can turn off the advice without losing the
notifications about real money.

### Automated nudges

The push series that prompts a business to finish setting something up — the
"set up your account to receive your money in your sleep" messages.

Each nudge is a **statement about the business's own state**, not a marketing
message. It fires because something is genuinely missing, it says what the
consequence is, and it goes quiet once the condition is fixed.

| Nudge | Fires when | Repeats? |
|---|---|---|
| **Get paid while you sleep** | Subscription running with no card on file | Once ever |
| Assistant nearly out of credit | Free credit spent, no paid balance | Fortnightly |
| Take payments without chasing them | No payment account connected | Once ever |
| Add your business number | Receptionist on, no line to answer | Once ever |
| Tell the assistant what you sell | No active services | Once ever |
| Put your booking link to work | Site published, no bookings yet | Monthly |
| You're owed money | An invoice unpaid for 30+ days | Fortnightly |

Three rules keep this from becoming spam, and all three are unit tested:

1. **At most one per business per run.** Missing five things produces a sequence
   over days, not five notifications in one afternoon. The catalogue is ordered
   by value, so getting paid comes before tidying the service list.
2. **One-offs stay one-off.** "You have no services" is a fact about setup; it is
   asked once and never again.
3. **Cooldowns, reset by resolution.** A repeatable nudge waits out its cooldown,
   and the clock restarts when the condition stops being true — so "you're owed
   money" can come back the next time it is true, rather than being silenced
   forever by the first send.

Nudges only reach businesses that have **installed the app** (push requires a
subscription), which is exactly who the user asked for, and any business can turn
them off with one switch.

`runNudges` is bounded, best-effort, and never lets one business's failure stop
the run.

---

## 4. The daily cron

`/api/cron/receptionist`, daily at 07:00 UTC, authenticated with `CRON_SECRET`:

1. **Collect** every due subscription with a card on file.
2. **Nudge** app users about what is missing.
3. **Chase the exceptions** — emails and pushes only for contracts that could not
   be collected automatically, and wallets that have run dry.

A clinic whose card works never hears from this job at all. That is the point:
the reminding exists for the cases automation couldn't handle, not as the
mechanism itself.

---

## 5. What's verified

`npm test` — the money paths are covered by the schema suite against real
Postgres:

- **charging the same month twice is impossible**: the claim takes the lock, a
  retry increments the attempt count, and a paid month can never be claimed again
  by a retry *or* a concurrent run — while the next month still collects;
- a contract can hold a reusable card, turn automatic collection off, and drop
  out of the cron's work list while off;
- a nudge is sent once, accumulates its count on one row, and can be resolved so
  a repeatable one returns;
- the setup-tips switch can be turned off without losing payment notifications.

And ten unit tests on the nudge logic, mostly about **when not to send**: a
one-off stays one-off, a repeatable waits its cooldown, a resolved condition
reopens it, an unknown or corrupt history is treated as never sent rather than
silence forever, and the choice is deterministic when several conditions are true
at once.

---

## 6. The admin reporting page

`/admin/insights` — five headline numbers, then the detail behind each. The
arithmetic lives in `src/lib/admin-insights.ts` (pure, 21 tests) and the queries in
`src/lib/db/admin-insights.ts`.

Two rules make the numbers trustworthy:

**A rate with no denominator is `null`, not `0`.** "0% conversion" and "nobody has
applied yet" are different facts, and showing them identically teaches an operator
to ignore the page.

**Prospect tenants are excluded from the customer count.** The lead engine creates a
real organization for every generated site, so counting them would claim hundreds of
customers acquired in a week where the business acquired none.

**Collected vs outstanding are separate.** Collected is derived from the schedule
(`amountForMonth(1..charges_paid)`), not from a stored total, so the dashboard cannot
disagree with the contract screen — both read the same function. Outstanding counts
only the remaining setup months of a live contract: after month six the contract is
month-to-month, so there is nothing "still to come".

The receptionist funnel is reported as **three** rates, because they fail for
different reasons and the fix is different:

| Rate | What a miss means |
|---|---|
| Got a text | A wallet ran dry, or Twilio rejected the message |
| Opened the chat | The message copy or the link |
| Became a booking | The assistant, or the clinic's service list |

Deliberately *not* shown: the receptionist's answer rate (we only ever see missed
calls, so it cannot be computed) and the lead engine's cost per acquisition (nothing
has converted, so the ratio would be invented).

## 7. Deliberate limitations

- **Only card payments auto-charge.** A clinic that pays by bank transfer gets
  the reminder, not the debit. Bank-transfer collection needs either a Paystack
  dedicated virtual account per business or a manual reconciliation step, and
  it's a real piece of work rather than a config change.
- **Three failures then flag — no dunning ladder.** Real collections use a
  schedule (retry in 3 days, then 5, then notify, then suspend). This retries
  daily and flags on the third failure, which is honest but blunt.
- **No pro-ration, no mid-month upgrades.** The contract is a fixed schedule.
- **Invoices have no partial payments.** An invoice is paid or it isn't; a
  customer paying half needs a second invoice, not a half-settled one. Worth
  fixing if customers ask.
- **No credit notes or refunds.** A refund today is an adjustment in the ledger,
  not a document.
