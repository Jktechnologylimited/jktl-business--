-- Invoice payment links: a public "pay via link" page a customer opens
-- (shared over WhatsApp, for now) that pays straight into the business's
-- own bank account through a Paystack subaccount split. JKTL's ₦50-per-
-- invoice fee is added on top of the invoice total — the payer bears it,
-- the business always receives the full invoice amount — taken by
-- Paystack's own `transaction_charge` split at the moment of payment (see
-- src/lib/paystack.ts's initializeInvoicePayment). Neither JKTL nor this
-- app ever holds or manually moves the money.

-- One row per business — their verified settlement bank account, and the
-- Paystack subaccount code created from it. `settlement_account_name` is
-- always the name Paystack's bank-resolve API returned for that account
-- number, never typed by hand, so a mistyped account number is caught
-- before it's ever saved (see savePaymentSettingsAction).
CREATE TABLE IF NOT EXISTS payment_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  settlement_bank_code TEXT NOT NULL DEFAULT '',
  settlement_bank_name TEXT NOT NULL DEFAULT '',
  settlement_account_number TEXT NOT NULL DEFAULT '',
  settlement_account_name TEXT NOT NULL DEFAULT '',
  paystack_subaccount_code TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which invoices were actually paid through the online link (vs. the
-- existing manual "Mark as paid" for cash / a direct bank transfer), and
-- what JKTL's cut and Paystack's own reference were on that one — for a
-- business's own records, and so the webhook can never double-apply a
-- payment (see markInvoicePaidOnline's WHERE status <> 'paid').
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_via TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS platform_fee_kobo BIGINT NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_reference TEXT NOT NULL DEFAULT '';

-- A business can opt out of JKTL's own downtime/promo broadcasts
-- separately from their own operational alerts (bookings, stock, etc.)
-- above — on by default, since downtime notices are worth keeping around
-- even for someone who'd rather skip promotional ones.
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS platform_announcements BOOLEAN NOT NULL DEFAULT true;

-- One row per broadcast the command center sends (downtime notices,
-- promotions, etc.) — just a history for the admin's own reference, not
-- something any business account can see or query. `recipient_count` is
-- how many devices actually received it at send time, not a live count.
CREATE TABLE IF NOT EXISTS admin_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  recipient_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
