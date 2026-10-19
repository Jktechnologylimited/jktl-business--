# ₦400m in 14 days — the arithmetic, and what it actually takes

Written because the target is concrete and the funnel has to be sized against it
before anything else is built. Software cannot sell 616 subscriptions. People can.
The useful thing software does is remove every *other* bottleneck so the sales
effort is not wasted — and that is what the bulk site build now does.

---

## 1. What ₦400,000,000 in 14 days actually requires

| Measured as | Price | Clients needed | Per day |
|---|---|---|---|
| Setup fee only | ₦650,000 | **616** | 44 |
| First instalment only | ₦108,333 | **3,693** | 264 |
| Year-1 contract value | ₦1,004,000 | **399** | 29 |

The realistic number is **400–620 paying clients, or about 30–44 a day.** Not
"signups" — paying clients, with money collected.

## 2. Cold email cannot do it, and the maths is not close

To close 616 clients by cold email, across plausible reply and close rates:

| Reply rate | Close rate | Emails needed | Per day |
|---|---|---|---|
| 1% | 5% | 1,230,000 | 87,857 |
| 3% | 5% | 410,000 | 29,285 |
| 1% | 10% | 615,000 | 43,928 |
| **3%** | **15%** | **136,667** | **9,762** |

Even the *best* cell — a 3% reply rate and a 15% close rate, both optimistic for
cold B2B — needs **~9,800 emails a day for fourteen days.**

A domain that emits 9,800 cold emails a day is blocklisted within hours, and it
takes the transactional mail with it: booking confirmations, receipts, invoice
notifications. The mail that must never be blocked. **Cold email is a
months-long channel, not a fortnight-long one.** Anyone planning ₦400m on it in
14 days is planning a number that cannot happen.

## 3. What does close at 30–44 clients a day

Concentration, not volume. Four things work at that speed, in this order:

**1. The pre-built site as the opening line.** This is the whole reason bulk
generation matters, and why it was worth building. "I already built your
website — here it is, claim it" is a fundamentally different conversation from
"would you like a website?". The prospect looks at *their own business*, with
*their own photographs and reviews*, already live. The objection collapses from
"do I need this?" to "what does it cost?".

**2. WhatsApp and voice over email.** A clinic replies to WhatsApp in minutes and
to email in weeks. Nigeria's response rates on WhatsApp are not comparable to
email — email is where a pitch goes to die. Twilio already supports WhatsApp on
the account, so the channel is one integration away, not a new vendor.

**3. A sales team.** 616 closes in 14 days, at a realistic 15% close rate, is
**~4,100 conversations.** Across 14 days that is ~290 conversations a day. One
person cannot hold 290 conversations a day; that is a team of roughly 10–15
people on WhatsApp and voice, and it is the actual cost of this target. Software
makes each conversation cheap; it does not have the conversations.

**4. Resellers, on the affiliate system that already exists.** One reseller
closing 20 clients is worth more than 200 cold emails. The affiliate
infrastructure — approve, verify bank, record payouts — is already built and
unused at this scale.

## 4. Where the bottleneck actually is

Not generation. Here is the whole pipeline and where the constraint sits:

```
12,000 leads scraped            ← solved (area × niche matrix)
   ↓ filtered to qualified      ← solved (website audit, score < 55)
   ↓ ~600 with rich listings    ← solved
   ↓ SITES GENERATED            ← SOLVED (this change: batch job + image mirroring)
   ↓ contacted                  ← ~600 conversations   ← THE BOTTLENECK
   ↓ ~90 replies at 15%
   ↓ ~14 paying clients
```

The funnel runs ~15% conversation → client. **600 conversations yields about 90
clients, not 616.** To reach 616 clients you need roughly 4,100 conversations,
which means either a much larger lead list than 12,000 or a sales team working
it repeatedly — and the leads list at 12,000 is the smaller problem.

## 5. What was built

### The bulk site build is now a real job

`buildSitesAction` built 20 sites per call, inside one HTTP request. A request
that takes twenty minutes has already timed out, so that was never going to reach
several hundred.

- **`startSiteBuildJob`** snapshots every qualified lead without a site into
  `site_build_targets` and returns immediately. So the admin sees a progress bar
  rather than a spinner that dies.
- **`advanceSiteBuildJob`** builds a bounded slice — six sites, three at a time —
  and is safe to call repeatedly, which is exactly what a cron does.
- **`/api/cron/build-sites`** runs every five minutes and advances whatever job is
  running. A job therefore progresses on its own, unattended. ~6 sites per run
  every 5 minutes is **~1,700 sites a day** of capacity, which is far more than
  the 600 that matter here.
- **Resumable.** Progress lives in the database. A crash mid-batch loses at most
  the site in flight, and the `(job_id, prospect_id)` primary key means a restart
  cannot double-build a business.
- **Per-business errors.** One malformed listing fails its own target and records
  why; it does not fail the batch. The admin gets a list of which business and
  what went wrong, not "something failed".

### Photographs are copied onto our own storage

Hot-linking Google's image URLs was not good enough for a page whose job is to
impress somebody:

- Google serves full-resolution originals, often several megabytes. Eight of those
  on a Nigerian mobile connection is a page that shows nothing for half a minute,
  which reads as incompetence rather than a slow CDN.
- Those URLs are not ours — they can be rate-limited, rotated or withdrawn, and a
  demo whose hero photograph is a broken-image icon is worse than one with no
  photograph.
- We cannot resize or serve modern formats from a URL we do not control.

Each image is now fetched once, size- and type-checked (content-length first, so a
40MB panorama is refused before it downloads), and re-uploaded. **On any failure
the original URL is kept** — mirroring is an optimisation, never a requirement, and
a working page with a hot-linked image beats a page with a hole in it.

### Ordering is deliberate

Targets are queued **richest listing first** — photos and reviews descending. The
first sites built are the ones that make the most persuasive demos, so if the job
is interrupted at 200, the 200 are the best 200.

---

## 6. Honest gaps

- **No claim flow.** A generated site has a preview banner, but no "Claim this
  website →" button that captures the owner and takes payment. That is the single
  highest-leverage missing piece for revenue: the whole pitch is "it already
  exists, here is how to own it", and right now there is nowhere to click. This is
  the next thing to build.
- **No regeneration.** When a listing changes, the site does not. Needed once
  owners start editing their own sites.
- **No WhatsApp channel yet.** Named above as the channel that would actually
  carry 600 conversations; the Twilio plumbing is in place, the approved template
  and consent flow are not.
- **No reseller kit.** The affiliate system exists but there is no pack explaining
  what a reseller says, which is what makes resellers productive quickly.
- **The 14-day window is the constraint, not the software.** At ~1,700 sites/day of
  capacity, generation stopped being the bottleneck the moment this landed. The
  bottleneck is 4,100 conversations, and that is a hiring and messaging problem.
