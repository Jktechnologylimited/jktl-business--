-- Storage overage moves from "included free once subscribed" to its own
-- metered add-on billed *alongside* the flat Website & Hosting plan (not a
-- replacement for it — team seats and a custom domain still work exactly
-- as before, gated by `isSubscriptionActive`). See `src/lib/billing.ts` for
-- the per-GB rate and the cost-plus math behind it, and
-- `src/lib/db/storage-overage.ts` for how a charge actually gets made.
--
-- Paystack has no native usage-based billing (unlike, say, Stripe's metered
-- prices), so this reuses the *reusable authorization* Paystack already
-- attaches to every successful charge: the same card token that pays the
-- flat subscription can be charged again, separately, for that cycle's
-- storage overage — no extra card entry, no separate mandate. This column
-- caches that token once it's seen; see `handleChargeSuccess` in the
-- Paystack webhook route for where it's captured.
ALTER TABLE infrastructure_accounts
  ADD COLUMN IF NOT EXISTS paystack_authorization_code TEXT NOT NULL DEFAULT '';

-- Append-only ledger of every overage-billing attempt — same reasoning as
-- `affiliate_earnings`/`affiliate_payouts`: a running balance can silently
-- drift, a log of what was actually attempted and its outcome can't. One
-- row per billing-cycle attempt per organization (not per GB or per day) —
-- `attempted_at` doubles as the natural "has this cycle already been
-- billed" check via the unique index below, since overage is charged once
-- per subscription renewal (see storage-overage.ts), not on a separate
-- schedule of its own.
CREATE TABLE IF NOT EXISTS storage_overage_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  overage_bytes BIGINT NOT NULL,
  amount_kobo BIGINT NOT NULL,
  paystack_reference TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('charged', 'failed', 'skipped')),
  failure_reason TEXT NOT NULL DEFAULT '',
  cycle_key TEXT NOT NULL, -- the renewal_date (as ISO date) this attempt covers, so a retried webhook can't double-charge the same cycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_storage_overage_charges_org ON storage_overage_charges(organization_id, created_at DESC);

-- One billing attempt per organization per cycle — the same protection
-- `paystack_webhook_events` gives the subscription charge itself, applied
-- here so a redelivered `charge.success` webhook can't bill overage twice
-- for the same renewal.
CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_overage_charges_org_cycle
  ON storage_overage_charges(organization_id, cycle_key);
