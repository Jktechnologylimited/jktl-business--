-- Reuse the existing programme outbox and shared renderer/provider for campaigns.
ALTER TABLE distribution_program_notices ALTER COLUMN affiliate_id DROP NOT NULL;
ALTER TABLE distribution_program_notices ADD COLUMN IF NOT EXISTS recipient_email text;
ALTER TABLE distribution_program_notices ADD COLUMN IF NOT EXISTS suppressed_at timestamptz;
CREATE TABLE IF NOT EXISTS affiliate_campaigns(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),subject text NOT NULL,body text NOT NULL,audience text NOT NULL,
 recipients jsonb NOT NULL,status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','QUEUED')),
 created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),confirmed_by text,confirmed_at timestamptz
);
