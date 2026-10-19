-- Targeting Africa only, for the next five years.
--
-- That is a product constraint with legal teeth, so it is enforced in the
-- schema rather than left as a note in a strategy doc. Three changes:
--
--  1. **Outreach country rules.** The lead engine could previously email any
--     address it had, anywhere. Africa is not one jurisdiction: South Africa's
--     POPIA, Egypt's PDPL and Morocco's Law 09-08 require *prior consent* for
--     electronic direct marketing, while Nigeria's NDPA leaves room for a
--     legitimate-interest basis. A single global "send" button is therefore
--     wrong, and the rules live in a table so counsel can adjust a market
--     without a deploy.
--
--  2. **Recorded consent.** Where the rule is "consent required", consent is
--     the *only* lawful route — so it has to be recorded per prospect, with
--     when and how, because the burden of proving it sits with us.
--
--  3. **Country per tenant.** Every phone number the product touches
--     (missed-call routing, callback SMS, WhatsApp links) was normalised as
--     Nigerian. A Kenyan or Ghanaian clinic's numbers would have been mangled,
--     so a business now carries its country.

-- ---------------------------------------------------------------------------
-- 1. Country rules
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS outreach_country_rules (
  -- ISO 3166-1 alpha-2, upper case.
  country_code TEXT PRIMARY KEY,
  country_name TEXT NOT NULL DEFAULT '',
  -- International dialling code, digits only ("234", "254", "27").
  dial_code TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT '',
  -- Conservative engineering default, NOT legal advice:
  --   permitted         — may be emailed with a working opt-out
  --   consent_required  — a recorded, provable consent is required first
  --   review_required   — no position taken; do not send until counsel confirms
  --   blocked           — do not send through this tool at all
  rule TEXT NOT NULL DEFAULT 'review_required'
    CHECK (rule IN ('permitted', 'consent_required', 'review_required', 'blocked')),
  -- The statute or reasoning behind the rule, shown to the admin.
  note TEXT NOT NULL DEFAULT '',
  -- True once a human has confirmed this row against local counsel, so the
  -- difference between "we decided this" and "this is the default" is visible.
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Consent per prospect
-- ---------------------------------------------------------------------------

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_note TEXT NOT NULL DEFAULT '',
  -- Set when the pipeline itself refuses to send, so the reason is auditable
  -- rather than living only in a toast message.
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_prospects_consent ON prospects(consent_at) WHERE consent_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Country per tenant
-- ---------------------------------------------------------------------------

-- Drives phone normalisation for the missed-call pipeline and the callback
-- SMS. Defaults to NG so existing rows behave exactly as they did before.
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'NG';

-- The seed is deliberately cautious and deliberately partial: the four
-- jurisdictions with explicit opt-in marketing statutes are marked
-- `consent_required`, Nigeria is `permitted` on a legitimate-interest basis
-- (the position this business already operates on, flagged for counsel), and
-- every other African country is `review_required` — which means the pipeline
-- will not email it until somebody has actually checked. Countries outside
-- Africa are blocked in code, not in this table, because the point is that the
-- list cannot accidentally grow.
INSERT INTO outreach_country_rules (country_code, country_name, dial_code, currency, rule, note) VALUES
  ('NG', 'Nigeria',        '234', 'NGN', 'permitted',        'NDPA 2023. Relies on the legitimate-interest basis for B2B outreach, with a working opt-out. Confirm with counsel before scaling volume.'),
  ('ZA', 'South Africa',   '27',  'ZAR', 'consent_required', 'POPIA s69: electronic direct marketing to a data subject requires prior opt-in consent, unless they are an existing customer.'),
  ('EG', 'Egypt',          '20',  'EGP', 'consent_required', 'PDPL 151/2020: prior consent required for direct marketing, plus licensing/registration obligations for the sender.'),
  ('MA', 'Morocco',        '212', 'MAD', 'consent_required', 'Law 09-08: prior consent for direct prospecting, and prior declaration to the CNDP for the processing itself.'),
  ('KE', 'Kenya',          '254', 'KES', 'consent_required', 'Data Protection Act 2019: consent or a documented legitimate interest, with ODPC registration for data controllers. Conservative default is consent.'),
  ('GH', 'Ghana',          '233', 'GHS', 'consent_required', 'Data Protection Act 2012 (Act 843): registration as a data controller and consent for marketing.'),
  ('TZ', 'Tanzania',       '255', 'TZS', 'review_required',  'Personal Data Protection Act 2022. Obtain local advice before emailing.'),
  ('UG', 'Uganda',         '256', 'UGX', 'review_required',  'Data Protection and Privacy Act 2019. Obtain local advice before emailing.'),
  ('RW', 'Rwanda',         '250', 'RWF', 'review_required',  'Law on personal data protection 2021. Obtain local advice before emailing.'),
  ('CI', 'Cote d''Ivoire', '225', 'XOF', 'review_required',  'Law 2013-450 on personal data protection. Obtain local advice before emailing.'),
  ('SN', 'Senegal',        '221', 'XOF', 'review_required',  'Law 2008-12 on personal data protection. Obtain local advice before emailing.'),
  ('CM', 'Cameroon',       '237', 'XAF', 'review_required',  'Law 2010/012 on cyber security and data protection. Obtain local advice before emailing.'),
  ('ET', 'Ethiopia',       '251', 'ETB', 'review_required',  'Personal Data Protection Proclamation. Obtain local advice before emailing.'),
  ('ZM', 'Zambia',         '260', 'ZMW', 'review_required',  'Data Protection Act 2021. Obtain local advice before emailing.'),
  ('ZW', 'Zimbabwe',       '263', 'ZWG', 'review_required',  'Cyber and Data Protection Act 2021. Obtain local advice before emailing.'),
  ('BW', 'Botswana',       '267', 'BWP', 'review_required',  'Data Protection Act 2018. Obtain local advice before emailing.'),
  ('NA', 'Namibia',        '264', 'NAD', 'review_required',  'Data Protection Act 2021. Obtain local advice before emailing.'),
  ('MU', 'Mauritius',      '230', 'MUR', 'review_required',  'Data Protection Act 2017. Obtain local advice before emailing.'),
  ('AO', 'Angola',         '244', 'AOA', 'review_required',  'Law 22/11 on data protection. Obtain local advice before emailing.'),
  ('MZ', 'Mozambique',     '258', 'MZN', 'review_required',  'Law 3/2017 on data protection. Obtain local advice before emailing.'),
  ('DZ', 'Algeria',        '213', 'DZD', 'review_required',  'Law 18-07 on data protection. Obtain local advice before emailing.'),
  ('TN', 'Tunisia',        '216', 'TND', 'review_required',  'Organic Law 2004-63 on data protection. Obtain local advice before emailing.'),
  ('LY', 'Libya',          '218', 'LYD', 'review_required',  'No comprehensive regime confirmed. Obtain local advice before emailing.'),
  ('SD', 'Sudan',          '249', 'SDG', 'review_required',  'No comprehensive regime confirmed. Obtain local advice before emailing.'),
  ('SS', 'South Sudan',    '211', 'SSP', 'review_required',  'No comprehensive regime confirmed. Obtain local advice before emailing.'),
  ('GM', 'Gambia',         '220', 'GMD', 'review_required',  'Data protection provisions under development. Obtain local advice.'),
  ('SL', 'Sierra Leone',   '232', 'SLE', 'review_required',  'No comprehensive regime confirmed. Obtain local advice before emailing.'),
  ('LR', 'Liberia',        '231', 'LRD', 'review_required',  'No comprehensive regime confirmed. Obtain local advice before emailing.'),
  ('TG', 'Togo',           '228', 'XOF', 'review_required',  'Law 2019-014 on personal data protection. Obtain local advice before emailing.'),
  ('BJ', 'Benin',          '229', 'XOF', 'review_required',  'Digital Code 2017. Obtain local advice before emailing.'),
  ('BF', 'Burkina Faso',   '226', 'XOF', 'review_required',  'Law 001-2013 on personal data protection. Obtain local advice before emailing.'),
  ('ML', 'Mali',           '223', 'XOF', 'review_required',  'Law 2013-015 on personal data protection. Obtain local advice before emailing.'),
  ('NE', 'Niger',          '227', 'XOF', 'review_required',  'Law 2017-28 on personal data protection. Obtain local advice before emailing.'),
  ('GN', 'Guinea',         '224', 'GNF', 'review_required',  'Law L/2016/037 on data protection. Obtain local advice before emailing.'),
  ('GW', 'Guinea-Bissau',  '245', 'XOF', 'review_required',  'No comprehensive regime confirmed. Obtain local advice before emailing.'),
  ('CV', 'Cabo Verde',     '238', 'CVE', 'review_required',  'Law 133/V/2001 on data protection. Obtain local advice before emailing.'),
  ('MR', 'Mauritania',     '222', 'MRU', 'review_required',  'Law 2017-020 on data protection. Obtain local advice before emailing.'),
  ('GA', 'Gabon',          '241', 'XAF', 'review_required',  'Law 001-2018 on data protection. Obtain local advice before emailing.'),
  ('CG', 'Congo',          '242', 'XAF', 'review_required',  'Law 29-2019 on data protection. Obtain local advice before emailing.'),
  ('CD', 'DR Congo',       '243', 'CDF', 'review_required',  'Law 20/017 on data protection. Obtain local advice before emailing.'),
  ('CF', 'Central African Republic', '236', 'XAF', 'review_required', 'No comprehensive regime confirmed. Obtain local advice.'),
  ('TD', 'Chad',           '235', 'XAF', 'review_required',  'Law 007/PR/2015 on data protection. Obtain local advice before emailing.'),
  ('GQ', 'Equatorial Guinea', '240', 'XAF', 'review_required', 'No comprehensive regime confirmed. Obtain local advice.'),
  ('ST', 'Sao Tome and Principe', '239', 'STN', 'review_required', 'No comprehensive regime confirmed. Obtain local advice.'),
  ('KM', 'Comoros',        '269', 'KMF', 'review_required',  'No comprehensive regime confirmed. Obtain local advice before emailing.'),
  ('MG', 'Madagascar',     '261', 'MGA', 'review_required',  'Law 2014-038 on data protection. Obtain local advice before emailing.'),
  ('SC', 'Seychelles',     '248', 'SCR', 'review_required',  'Data Protection Act 2023. Obtain local advice before emailing.'),
  ('DJ', 'Djibouti',       '253', 'DJF', 'review_required',  'No comprehensive regime confirmed. Obtain local advice before emailing.'),
  ('SO', 'Somalia',        '252', 'SOS', 'review_required',  'No comprehensive regime confirmed. Obtain local advice before emailing.'),
  ('ER', 'Eritrea',        '291', 'ERN', 'review_required',  'No comprehensive regime confirmed. Obtain local advice before emailing.'),
  ('BI', 'Burundi',        '257', 'BIF', 'review_required',  'Law 2019 on personal data protection. Obtain local advice before emailing.'),
  ('MW', 'Malawi',         '265', 'MWK', 'review_required',  'Data Protection Act 2024. Obtain local advice before emailing.'),
  ('LS', 'Lesotho',        '266', 'LSL', 'review_required',  'Data Protection Act 2011. Obtain local advice before emailing.'),
  ('SZ', 'Eswatini',       '268', 'SZL', 'review_required',  'Data Protection Act 2022. Obtain local advice before emailing.')
ON CONFLICT (country_code) DO NOTHING;
