# The Partner Programme

₦20,000 when a business you refer creates an account. ₦40,000 more when they
subscribe. ₦3,500 every month they stay subscribed.

**₦102,000 from one referral in the first year** — which is the number to sell
with, and the reason the tiers are fixed amounts rather than a percentage.
"20% recurring" makes a partner do arithmetic against a price list;
"₦102,000 per referral" does not.

---

## 1. Where the programme lives — and what was already there

**There were two complete, separate partner programmes**, and that is the root of
the confusion this section resolves.

| | Marketing site (`jktl.com.ng`) | Business app (`business.jktl.com.ng`) |
|---|---|---|
| Pitch page | `/affiliates` | `/affiliates` (public landing) |
| Signup | `/affiliates/join` | `/affiliates/apply` |
| Sign-in | `/affiliates/login` | `/affiliates/login` |
| Dashboard | 7 pages under `/affiliates/dashboard/*` | 1 page at `/affiliates` + `/affiliates/playbook` |
| Forgot / reset password | **Yes** | **No** |
| Payouts | `/api/affiliates/payout` | `/affiliates` payout window, day 21 |
| Admin approval | `/api/affiliates/admin/*` | `/admin/affiliates` |
| Schema | `first_name`, `last_name`, `tier`, `business_name` | `name`, `commission_bps`, `application_note` |
| Database | **Its own** | Its own (subscriptions, Paystack webhook) |
| Commission | 20% of payments | **₦20,000 / ₦40,000 / ₦3,500 tiers** |

The schemas are incompatible, which means **two databases and two programmes**.
An application submitted on the marketing site was invisible to
`business.jktl.com.ng/admin/affiliates` — you would never have seen it. That is
the answer to "then I see it on the admin side of jktl business": you would not
have.

**The business app wins**, because it owns the accounts, the Paystack webhook and
the subscription events the commission is actually paid on. The marketing site's
programme is retired: its pages redirect, and its API routes now return
`410 Gone` with a pointer rather than quietly accepting applications into a ledger
nobody reads.

### The two URLs that matter

These are canonical. Everything else is a redirect into one of them.

| | URL |
|---|---|
| **Apply / register** | `https://business.jktl.com.ng/affiliates/apply` |
| **Sign in** | `https://business.jktl.com.ng/affiliates/login` |
| Landing page (public pitch) | `https://jktl.com.ng/affiliates` |
| Admin approval queue | `https://business.jktl.com.ng/admin/affiliates` |

### The flow

```
STEP 1  jktl.com.ng/affiliates            → the pitch (200, public, indexed)
STEP 2  "Apply to join"                   → business.jktl.com.ng/affiliates/apply
STEP 3  applicant sets a password         → status 'pending'
STEP 4  admin approves at /admin/affiliates
STEP 5  approval email arrives            → sign-in link + referral link + tiers
STEP 6  business.jktl.com.ng/affiliates/login
STEP 7  dashboard                         → link, earnings, reports, payouts
```

Every legacy path lands on a real page (verified by running the app):

| Old path | Lands on |
|---|---|
| `/affiliate` | `/affiliates` (the landing page, same domain) |
| `/affiliates/join` | app `/affiliates/apply` |
| `/affiliates/register` | app `/affiliates/apply` |
| `/affiliates/signup` | app `/affiliates/apply` |
| `/affiliates/login` | app `/affiliates/login` |
| `/affiliates/dashboard/*` | app `/affiliates` |
| `/affiliates/pending` | app `/affiliates/login` |
| `/affiliates/forgot-password` | app `/affiliates/forgot-password` |
| `/affiliates?ref=X` | the landing page, query preserved |

The two spellings both work inside the app: `/affiliate` and anything under it
`307`s to the plural route, so `/affiliate/apply` and `/affiliate/login` reach the
right pages.

Both spellings work in the app: `/affiliate` and anything under it `307`s to the
plural route, so `/affiliate/login` and `/affiliate/apply` reach the right pages.

**A signed-out visitor to `/affiliates` sees the programme, not a login form** —
the three tiers, how payouts work, and buttons to apply or sign in. It used to
redirect straight to `/affiliates/login`, which is why the signup page looked
missing: it existed at `/affiliates/apply` and nothing pointed at it.

**Applying and signing in are different pages, and say so.** The apply form's
confirmation spells out `business.jktl.com.ng/affiliates/login` and tells the
applicant they will be emailed on approval — because the two pages look identical
to somebody who has only seen one, and "where do I sign in?" is the question an
approved partner is most likely to have.

Legacy marketing paths are mapped onto real routes rather than prefix-rewritten,
because a blind prefix rewrite sends links already circulating in WhatsApp groups
to a 404:

The handover is checked **before the CMS redirects table**, so a stale redirect
can never swallow an affiliate link, and the query string is preserved because
referral codes and UTM tags are exactly what must not be dropped in transit.

## 2. Why the signup bonus is held

A fixed ₦20,000 for a bare signup is **farmable**. Create a hundred free
accounts, collect ₦2m, and nobody has paid anything. So:

| Tier | When it is written | When it becomes withdrawable |
|---|---|---|
| ₦20,000 signup | The moment the referral creates an account | **When they subscribe** |
| ₦40,000 subscription | The first real payment | Immediately |
| ₦3,500 recurring | Every month the subscription is live | Immediately |

The signup bonus is shown to the partner straight away as **pending** — they did
the work, and hiding it would be its own dishonesty — but it is excluded from the
withdrawable balance until the referral pays. `summariseEarnings` owns that rule
and `requestPayout` refuses on the withdrawable figure, not the headline one.

The structure is exactly as specified. Only the *timing of the withdrawal* is
guarded, the dashboard says so in plain words, and the guard costs a legitimate
partner nothing: their ₦60,000 lands in one go the moment their referral
subscribes.

## 3. Double payment is structurally impossible

Enforced by the database, not by careful calling:

- **`(affiliate, business, kind)` unique** for `signup` and `subscription` — a
  redelivered Paystack webhook cannot pay ₦40,000 twice.
- **`(affiliate, business, period_key)` unique** for `recurring` — a webhook
  replayed within the same month cannot pay ₦3,500 twice, and neither can the
  cron running alongside it.
- `period_key` is `YYYY-MM` in **Lagos time**. A clinic charged at 00:30 local is
  still in the previous month by UTC reckoning, which would credit the wrong
  month.

Whether this is the *first* payment is read from the ledger, not from a counter,
so a replay cannot make the second payment look like the first and pay ₦40,000
again.

## 4. The recurring month

Paid for **every month the subscription is live, including the first.**

That is a correction worth recording. An earlier version started the series the
month *after* the subscription, which quietly made the real first-year figure
₦98,500 while the marketing site promised ₦102,000. The promise won, because "every
month they stay subscribed" is what was asked for and the first month is a month.

Two things credit it:

- **The Paystack webhook**, at the moment a payment arrives.
- **`/api/cron/affiliate-commissions`**, daily, as the safety net: a subscription
  renewing by a route we do not process, a lost webhook, or a payment recorded by
  hand. Without it a partner silently loses a month, and "we noticed we underpaid
  you" is not a recoverable conversation. The unique index means the cron can only
  ever fill a gap.

Commission accrues on **both** the Website & Hosting subscription and the AI
receptionist contract, because the receptionist *is* a subscription and a
referred clinic paying for it has subscribed in every sense the programme means.
It is accrued inside `applyContractPayment` rather than in the webhook, because a
month collected automatically never passes through the webhook — and a partner
silently missing commission on the months that renew themselves would be the
worst possible bug in this feature.

## 5. What the partner sees

The dashboard opens with the three tiers as a plain sequence, then:

- **Withdrawable now** — released money, minus what has been paid out.
- **Pending (held)** — the signup bonus, with the reason in one sentence.
- **Recurring** — the monthly run-rate across their live referrals.
- Referred businesses, full earnings history, payout history and requests.

Per-affiliate terms are stored on the affiliate row
(`signup_bonus_kobo`, `subscription_bonus_kobo`, `recurring_monthly_kobo`,
`recurring_months_cap`), so a negotiated deal needs no code change. The defaults
are the published programme, and the dashboard renders whatever the ledger will
actually pay — it never states a rate the ledger does not honour.

## 6. What's verified

24 unit tests on the rules, most of them about **when money must not be paid**:

- a first payment earns the subscription bonus *and* releases the signup bonus;
- a later payment earns exactly one month, and the amount does not depend on what
  the customer paid — a clinic on the ₦108,333 instalment and one on the ₦59,000
  fee earn their partner the same ₦3,500;
- pending earnings are not withdrawable, money already paid out is not available
  again, and an overpayment shows zero rather than a negative balance;
- the promised ₦102,000 and the ledger agree, walked end to end through a full
  year;
- **a malformed period key produces nothing.** This was a real bug the tests
  caught: the month loop compared period keys as strings, so `"nonsense"` sorted
  above every real month and the loop ran to its guard — proposing ~240 months of
  ₦3,500, about **₦840,000 nobody had earned**.

## 7. Self-serve password reset

Built. A partner who forgets their password resets it themselves:

```
/affiliates/login  →  "Forgot your password?"  →  /affiliates/forgot-password
   →  email with a one-time link  →  /affiliates/reset-password?token=…  →  sign in
```

A reset flow is the most attractive surface in any authenticated app — a working
token is a full account takeover — so the design is worth stating:

**The token is never stored.** Only its SHA-256 hash is. A database leak that
exposes these rows must not hand the attacker a working reset link, which a
plaintext token column would do exactly. 256 bits from `randomBytes`, base64url so
it survives a URL and an email client.

**A plain SHA-256, not bcrypt** — the opposite of the choice made for passwords,
and deliberately so. A password is low-entropy and needs a slow hash to resist
guessing; this is 256 bits of uniform randomness, so there is nothing to guess and
a slow hash would only make every request cost CPU.

**Single use, 30 minutes.** `used_at` is claimed with `used_at IS NULL` in the
`WHERE` clause, so two submissions of the same link cannot both set a password. A
reset link is a bearer credential, and the window it works in is the window an
attacker has if it leaks out of an inbox.

**A new request kills the old links.** Otherwise a partner who clicks "resend"
twice holds two working credentials — and so does anyone who saw the first email.

**The reset signs them out everywhere.** Every session row for that partner is
deleted on completion. This is the part that is easy to forget and the reason a
reset is not just a password change: people usually reset a password because they
believe it is *compromised*, and leaving the attacker's session alive would make
the whole exercise decorative.

**The response never reveals whether an address exists.** The confirmation is
identical either way. An endpoint that says "no account with that email" is an
account-enumeration oracle, and on a partner programme the email list *is* the
sales pipeline. Even an internal error returns the generic message, because an
error path that behaves differently for a known address is the same oracle by
another route.

**Rate limited to 3 requests per partner per hour.** The form is otherwise a way
to make our domain send somebody an unbounded number of emails, and a sending
reputation that transactional mail depends on is not worth spending on a
convenience. It counts requests, not successes.

**Junk tokens never reach the database.** `isPlausibleToken` rejects anything that
could not have been issued, so the cheapest possible traffic is absorbed before a
query.

**Malformed rows fail closed.** An unparseable `expires_at` is treated as
*expired*, never as valid — failing open on a bad timestamp would be a credential
bypass.

The reason the three failure states are distinguished is that a partner who
clicked a link twice needs to read "already used", not "invalid" — the same
three messages are asserted distinct in the tests.

### What's verified

20 unit tests on the token rules, most of them about **failure**: an unguessable
token, a stored hash that is never the token, 200 tokens all different, single
use, supersession, expiry to the second, unparseable expiry failing closed, and
every failure state having a distinct message a person can act on.

Plus, against real Postgres: a link claimed exactly once (a second submission
fails), an expired or superseded link refused, a new request killing the old one,
**every session deleted on completion**, the rate-limit window counting correctly,
and a suspended partner's live token being refused.

And verified by running the app: `/affiliates/forgot-password` and
`/affiliates/reset-password` both return 200, the sign-in page links to the flow,
and `/affiliates/reset-password?token=…` carries the token through the marketing
redirect intact.

## 8. Open items

- **Payouts are still manual.** You transfer and log it; there is no Paystack
  transfer integration, by design. At a few hundred partners that becomes the
  bottleneck.
- **No partner-facing tax or invoice documents.** A Nigerian partner earning
  ₦1m+ a year will ask.
- **The marketing site's own affiliate dashboard is now unreachable** — it
  redirects, as instructed. If any of it should be kept, it has to be ported into
  the business app rather than left to rot behind a redirect.
- **Attribution is first-touch at signup.** A partner whose referral later
  mentions them gets nothing, which is the right default but worth stating.
