# Targeting Africa Only

*"Africa only, for the next five years"* is a constraint with legal, technical
and commercial consequences — so parts of it are now **enforced in code**
rather than remembered. This documents what changed, what it means per market,
and what is still open.

---

## 1. What is now enforced

**The lead engine will not email outside Africa.** The send path asks a
jurisdiction rule for every prospect before it sends, and refuses when the
answer isn't clearly "yes":

| Rule | Meaning | Sends? |
|---|---|---|
| `permitted` | Opt-out outreach is defensible here | yes |
| `consent_required` | Prior, recorded consent is the only lawful route | only with consent on the prospect |
| `review_required` | No position taken yet | **no** |
| `blocked` | Outside the target region | **no** |

The rules live in `outreach_country_rules` (migration 018), not in code, so a
market opens with a form in `/admin/prospects → Countries` — attributed to the
admin who did it and stamped as reviewed. The refusal is recorded on the
prospect (`blocked_reason`), so the reason a lead never got an email is
auditable rather than lost in a toast.

Default state of the 54 African countries:

- **1 permitted** — Nigeria, on the NDPA's legitimate-interest basis, flagged
  in its note as a decision to confirm with counsel rather than an oversight.
- **5 consent-required** — South Africa (POPIA s69), Egypt (PDPL), Morocco
  (Law 09-08), Kenya (DPA 2019), Ghana (Act 843). Each note names the statute.
- **48 review-required** — no position taken, so nothing sends.

**This is engineering, not legal advice.** Exactly one country is open by
default, and that is deliberate: it means no market has been opened without
somebody deciding to.

---

## 2. Why Africa is harder than GDPR, not easier

The instinct is that dropping the EU simplifies compliance. It doesn't — it
swaps one regime for fifty-four, several of which are *stricter* on cold
outreach than anything in Europe:

- **South Africa — POPIA s69.** Electronic direct marketing to a data subject
  requires **prior opt-in consent**, with a narrow existing-customer exception.
  A company is a data subject under POPIA, so B2B gets no free pass. This is
  the single most restrictive rule in the table.
- **Egypt — PDPL 151/2020.** Prior consent for direct marketing *plus*
  licensing and registration duties on the sender. Consent alone may not be
  sufficient.
- **Morocco — Law 09-08.** Prior consent, and prior declaration of the
  processing to the CNDP.
- **Kenya — DPA 2019.** Consent or a documented legitimate interest, and ODPC
  registration for data controllers.
- **Ghana — Act 843.** Data-controller registration and consent for marketing.
- **Nigeria — NDPA 2023.** The most workable of the group for B2B, on a
  legitimate-interest basis with a working opt-out — which is the basis this
  business already operates on.

The practical consequence: **consent, recorded with when and how, is a product
feature**, not a checkbox. That is why `recordConsentAction` demands a note
("replied on WhatsApp on 3 March asking us to rebuild their site") rather than
a bare timestamp — the burden of proving consent sits with the sender.

### Registration duties are separate from marketing rules

Several of these regimes require the *data controller* to register before
processing at all, independent of whether you email anyone. That is an
obligation on JKTL as a business, and it is not something code can satisfy —
`review_required` is what stops the software running ahead of it.

---

## 3. Phones across the continent

Every number in this product was read as Nigerian: `+234`, an eleven-digit
national number, a leading trunk zero. That would have turned a Kenyan
`0712 345 678` into `234712345678` and texted a stranger.

`src/lib/phone.ts` now generalises it, and the missed-call pipeline normalises
against **the clinic's own country** (`business_profiles.country_code`, which
is now a field in Settings → Business):

| Input | Country | Result |
|---|---|---|
| `0803 441 2291` | NG | `2348034412291` |
| `0712 345 678` | KE | `254712345678` |
| `712345678` | KE | `254712345678` (no trunk zero) |
| `00254712345678` | KE | `254712345678` |
| `024 123 4567` | GH | `233241234567` |
| `082 123 4567` | ZA | `27821234567` |

Two properties are tested specifically, because both are ways to text the wrong
person: a number that is **already international for another country is never
reshaped** into the local one, and rubbish input returns empty rather than a
plausible-looking number.

Inbound-call routing still keys on the subscriber tail, so a stored
"0700 000 1234" and a webhook's "+2347000001234" resolve to the same clinic.

---

## 4. What is *not* done yet

Four things stand between "works in Nigeria" and "works across Africa", in the
order I'd tackle them:

**1. Currency — the biggest one.** The entire pricing model is naira-kobo
(`src/lib/ai/pricing.ts`): ₦650,000 over six instalments, ₦59,000/month,
₦4.50 per SMS. That is one country's pricing. A pan-African product needs
either localized price points per market (with the FX and purchasing-power
work that implies) or a single anchor currency. Paystack covers Nigeria, Ghana,
Kenya and South Africa; beyond those you'd need a second processor. **This is a
business decision I need from you before building it.**

**2. Language.** The product — dashboard, chatbot, SMS templates, outreach
emails — is English-only. That is fine for Nigeria, Kenya, Ghana, South Africa,
Uganda, Tanzania and Zimbabwe, and not fine for Francophone Africa (Senegal,
Côte d'Ivoire, Cameroon, DRC, ~20 countries), Lusophone (Angola, Mozambique) or
the Maghreb (Egypt, Morocco, Algeria, Tunisia). The AI receptionist is the
cheapest place to start, since a prompt and a pack can be localized without
touching every screen. **Which, and when?**

**3. SMS pricing and sender IDs are per country.** `SMS_UNIT_COST_KOBO` is
₦4.50, which is a Nigerian blended rate. Every market has different
termination costs, sender-ID registration rules and — in several — a DND/opt-in
requirement of its own. The wallet guardrail is already per-clinic, so the data
model supports it; what's missing is a per-country unit-cost table and a
Termii (or regional aggregator) route per country.

**4. Data residency.** NDPA, Egypt's PDPL and others have cross-border
transfer provisions. The database (Neon) and hosting (Vercel) are almost
certainly on EU/US infrastructure. Whether that's a problem depends on the
markets you actually enter and whether you rely on adequacy or consent for the
transfer — worth raising with counsel *before* the first non-Nigerian customer,
not after.

---

## 5. The first three markets: Ghana, Côte d'Ivoire, Senegal

Decided. Two of them change the plan materially, and both are now encoded in
`src/lib/markets.ts` rather than in a strategy document.

| | Ghana | Côte d'Ivoire | Senegal |
|---|---|---|---|
| **Language** | English | **French** | **French** |
| **Currency** | GHS (pesewas) | **XOF (no subunit)** | **XOF (no subunit)** |
| **Paystack** | yes | **no** | **no** |
| **Real rails** | MTN MoMo, Vodafone Cash, Card | Wave, Orange Money, MoMo | Wave, Orange Money |
| **Marketing rule** | consent required | consent required | consent required |
| **Price points** | not agreed | not agreed | not agreed |

### The two hard consequences

**1. French is needed for market two, not market five.** The dashboard, the
chatbot, the SMS templates, the invoices and the outreach emails are all
English-only. Côte d'Ivoire and Senegal do not read English.

**2. The CFA franc has no subunit — and this product stores money in hundredths.**
Every amount in this codebase is kobo (÷100). XOF has no centime in
circulation: the franc *is* the smallest unit. Stored the way naira is stored,
a payment would reach the processor **100× too large**, and the wrong number
would sit in the database looking entirely normal.

`src/lib/markets.ts` makes that impossible to forget: each currency declares its
own `minorUnits` (100 for NGN and GHS, **1 for XOF**), amounts are checked with
`isChargeableAmount` before they can be used, and a price like
"412,345.5 francs" is refused rather than rounded. 16 tests, most of them about
this specific trap.

### Payment rails are the blocker, not the software

Côte d'Ivoire and Senegal **cannot take a single payment today** — there is no
processor wired up, because Paystack does not operate in either. Everything
else about those markets is buildable; revenue is not, until a Francophone rail
(Wave, Orange Money, or a processor that aggregates them) is in place.

`marketReadiness()` reports each market's blockers in the order they block, so
this is visible rather than remembered.

### What is still needed before either goes live

1. **A processor** for CI/SN, or a decision to launch Ghana first and defer.
2. **Price points per market.** Deliberately left empty: converting ₦650,000 at
   today's rate and calling it a price is a decision, not a calculation.
   `setPricePoints()` refuses anything inconsistent — instalments that do not
   equal the package, or a fractional amount in francs.
3. **The French layer**, scoped below.
4. **Registration duties.** Consent is the marketing route in; registering as a
   data controller in each country is a separate obligation, and code cannot
   satisfy it.

## 6. Questions still open

1. **One currency or localized pricing?** With XOF covering two of the three
   markets, and the CFA pegged to the euro, the mechanics are simple. The
   question is whether ₦650,000 → CFA is translated at FX or repriced for local
   willingness to pay. The latter sells better.
2. **Wave/Orange Money first, or Ghana first?** Ghana can take money tomorrow;
   CI and Senegal cannot. Launching Ghana first and using the revenue to fund
   the Francophone rails is the lower-risk sequence.
3. **Which surfaces get French first?** The chatbot, SMS and invoice are
   customer-facing and cheapest to localise (a pack and a template each). The
   dashboard is internal and can stay English for a while.

---

## 6. Verification

`npm test` — 173 tests, all passing. This change added 19:

- the African list is complete and internally consistent (no duplicate codes,
  every country has a dialling code, a currency and a usable reason);
- country names, ISO codes and city-suffixed values all resolve — including
  `Côte d'Ivoire`, which a naive accent strip turns into `cte d'ivoire`;
- **non-African countries are refused even with consent recorded**, and an
  unidentifiable country is never treated as anywhere;
- an opt-in market refuses without consent and opens with it;
- Nigeria works out of the box, and South Africa's refusal names POPIA;
- exactly one country is permitted by default;
- an override opens a market without a deploy — and can close one;
- phone normalisation for nine countries, the "already international for
  another country" protection, display formatting, WhatsApp links and
  subscriber-key matching.

Plus four schema tests that apply migration 018 to a real Postgres: the rules
seed correctly with exactly one permitted country, consent can be recorded and
withdrawn, and tenants default to Nigeria so existing behaviour is unchanged.

Two real bugs were caught in the process: the accent-stripping one above, and
the discovery that my own note-length assertion was stricter than the content
it was checking.
