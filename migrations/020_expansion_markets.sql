-- Opening the three expansion markets: Ghana, Côte d'Ivoire, Senegal.
--
-- Two things change.
--
-- 1. **The rules for those markets become actionable.** Ghana was already
--    `consent_required`; Côte d'Ivoire and Senegal were `review_required`,
--    which blocks sending entirely. They are now `consent_required` instead,
--    which is not a claim that outreach is lawful without consent — it is the
--    opposite. Consent is the one basis that always works, so recording it per
--    prospect is now the route into those markets rather than a legal opinion
--    nobody has obtained yet. The notes still say local advice is needed for the
--    processing itself (registration, declaration), which is a separate duty
--    from the marketing rule.
--
-- 2. **Each country row learns what it needs to operate**, so the gaps are
--    visible in the admin rather than in somebody's head: the language its
--    customers read, the currency it bills in, whether the incumbent payment
--    processor reaches it, and what people actually pay with. Côte d'Ivoire and
--    Senegal are the two that cannot take a single payment today.

ALTER TABLE outreach_country_rules
  -- ISO 639-1. 'fr' means every customer-facing surface needs translating before
  -- this market can be served.
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT '',
  -- Whether Paystack covers the country. False is a hard blocker on revenue,
  -- not a preference.
  ADD COLUMN IF NOT EXISTS paystack_supported BOOLEAN NOT NULL DEFAULT false,
  -- What people actually pay with, comma-separated, for whoever sets the
  -- checkout up.
  ADD COLUMN IF NOT EXISTS payment_rails TEXT NOT NULL DEFAULT '',
  -- True once somebody has agreed the local price points. Until then the market
  -- has no price and cannot be quoted — see src/lib/markets.ts.
  ADD COLUMN IF NOT EXISTS priced BOOLEAN NOT NULL DEFAULT false;

-- The home market: English, naira, Paystack, already priced.
UPDATE outreach_country_rules SET
  language = 'en', currency = 'NGN', paystack_supported = true, priced = true,
  payment_rails = 'Card, Bank transfer, USSD'
WHERE country_code = 'NG';

-- Ghana: English (so no translation needed), cedis, Paystack covers it.
-- Price points still to be agreed.
UPDATE outreach_country_rules SET
  rule = 'consent_required',
  language = 'en',
  currency = 'GHS',
  paystack_supported = true,
  priced = false,
  payment_rails = 'Mobile money (MTN MoMo, Vodafone Cash, AirtelTigo), Card',
  note = 'Data Protection Act 2012 (Act 843): data-controller registration and consent for marketing. Consent is recorded per business in the lead engine. Confirm registration duties before onboarding customers.'
WHERE country_code = 'GH';

-- Côte d'Ivoire: French, CFA franc (no subunit — see src/lib/markets.ts), and
-- Paystack does not operate here.
UPDATE outreach_country_rules SET
  rule = 'consent_required',
  language = 'fr',
  currency = 'XOF',
  paystack_supported = false,
  priced = false,
  payment_rails = 'Wave, Orange Money, MTN MoMo, Moov Money',
  note = 'Law 2013-450 on personal data protection. Consent recorded per business before any outreach, and local advice taken on registration before onboarding. No Paystack coverage — a Francophone processor is required first.'
WHERE country_code = 'CI';

-- Senegal: same shape as Côte d'Ivoire.
UPDATE outreach_country_rules SET
  rule = 'consent_required',
  language = 'fr',
  currency = 'XOF',
  paystack_supported = false,
  priced = false,
  payment_rails = 'Wave, Orange Money, Free Money',
  note = 'Law 2008-12 on personal data protection. Consent recorded per business before any outreach, and local advice taken on registration before onboarding. No Paystack coverage — Wave and Orange Money are the rails that matter.'
WHERE country_code = 'SN';

CREATE INDEX IF NOT EXISTS idx_country_rules_expansion
  ON outreach_country_rules(currency, language) WHERE currency <> '';
