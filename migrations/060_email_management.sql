-- Reuse the programme queue and existing draft/invitation tables. No new inbox,
-- authentication store, sending provider or background job.
ALTER TABLE affiliate_campaigns ADD COLUMN IF NOT EXISTS message_kind text NOT NULL DEFAULT 'marketing' CHECK(message_kind IN('marketing','operational'));
ALTER TABLE affiliate_campaigns ADD COLUMN IF NOT EXISTS reply_to text NOT NULL DEFAULT '';
ALTER TABLE affiliate_campaigns ADD COLUMN IF NOT EXISTS interface text NOT NULL DEFAULT 'affiliate' CHECK(interface IN('affiliate','emails'));
ALTER TABLE distribution_program_notices ADD COLUMN IF NOT EXISTS composed_id uuid REFERENCES affiliate_campaigns(id);
ALTER TABLE distribution_program_notices ADD COLUMN IF NOT EXISTS reply_to text NOT NULL DEFAULT '';
ALTER TABLE distribution_program_notices ADD COLUMN IF NOT EXISTS send_state text NOT NULL DEFAULT 'QUEUED' CHECK(send_state IN('QUEUED','SUBMITTING','ACCEPTED','FAILED','UNKNOWN'));
ALTER TABLE distribution_program_notices ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE distribution_program_notices ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE distribution_program_notices ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
CREATE TABLE IF NOT EXISTS email_send_history(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),attempt_key text UNIQUE,recipient text NOT NULL,subject text NOT NULL,category text NOT NULL,
 provider_message_id text,provider_state text NOT NULL CHECK(provider_state IN('ACCEPTED','FAILED','UNKNOWN','SUPPRESSED')),
 error_code text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_send_history_recent ON email_send_history(created_at DESC);
ALTER TABLE editorial_invitations ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE editorial_invitations ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';
ALTER TABLE editorial_invitations ADD COLUMN IF NOT EXISTS message text NOT NULL DEFAULT '';
ALTER TABLE editorial_invitations ADD COLUMN IF NOT EXISTS target_role text;
ALTER TABLE editorial_invitations ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE editorial_invitations ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE editorial_invitations ADD COLUMN IF NOT EXISTS accept_mode text NOT NULL DEFAULT 'NEW_TEAM' CHECK(accept_mode IN('NEW_TEAM','BUSINESS','TEAM'));
ALTER TABLE affiliate_invitations ADD COLUMN IF NOT EXISTS program text NOT NULL DEFAULT 'affiliate' CHECK(program IN('affiliate','partner'));
-- Preserve current policies, accepted grants and old expiry dates. New central
-- invitations use a configurable 48-hour default; expired links can be rotated.
DROP INDEX IF EXISTS affiliate_live_invitation;
CREATE UNIQUE INDEX affiliate_live_invitation ON affiliate_invitations(lower(email),program) WHERE accepted_at IS NULL AND revoked_at IS NULL;
-- Keep the newest outstanding team invitation if legacy data contains more
-- than one, then enforce one live invitation per profile under concurrency.
WITH ranked AS(SELECT id,row_number() OVER(PARTITION BY user_id ORDER BY expires_at DESC,created_at DESC,id DESC) n FROM editorial_invitations WHERE accepted_at IS NULL AND revoked_at IS NULL)
UPDATE editorial_invitations SET revoked_at=now() WHERE id IN(SELECT id FROM ranked WHERE n>1);
CREATE UNIQUE INDEX IF NOT EXISTS editorial_live_invitation ON editorial_invitations(user_id) WHERE accepted_at IS NULL AND revoked_at IS NULL;
