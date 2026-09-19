-- Push notifications, replacing the old "emails send once Resend is
-- connected" placeholder on the Settings > Notifications panel. Real Web
-- Push (VAPID) — see src/lib/push.ts — for: new bookings, low-stock
-- alerts, invoices marked paid, and a daily summary of yesterday's numbers.
--
-- Both tables hold only short strings (a push endpoint URL, short base64
-- key material) — nothing here can ever hold an inline base64 *image*,
-- so none of this repeats the migration 005/007 index-size mistake.

-- One row per business, defaults matching what the old client-only toggles
-- used to default to (booking/low-stock on, daily summary off) so nothing
-- changes for a business until they actually turn push on.
CREATE TABLE IF NOT EXISTS notification_preferences (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  push_enabled BOOLEAN NOT NULL DEFAULT false,
  booking_notifications BOOLEAN NOT NULL DEFAULT true,
  low_stock_alerts BOOLEAN NOT NULL DEFAULT true,
  invoice_paid_alerts BOOLEAN NOT NULL DEFAULT true,
  daily_summary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per subscribed device/browser. `endpoint` is unique per the Push
-- API's own contract (it's the push service's per-subscription URL), which
-- doubles as our natural upsert key when the same device re-subscribes.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_org ON push_subscriptions(organization_id);
