-- Team compensation details are independent of merchant/affiliate settlement.
CREATE TABLE IF NOT EXISTS team_payment_details (
 admin_id uuid PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
 bank_code text,
 bank_name text,
 account_last4 text CHECK(account_last4 IS NULL OR account_last4 ~ '^[0-9]{4}$'),
 encrypted_details text,
 status text NOT NULL CHECK(status IN('PENDING','APPROVED','REJECTED','REMOVED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 verified_at timestamptz,
 reviewed_by uuid,
 reviewed_at timestamptz,
 review_note text NOT NULL DEFAULT '' CHECK(length(review_note)<=500),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='REMOVED' AND encrypted_details IS NULL AND bank_code IS NULL AND bank_name IS NULL AND account_last4 IS NULL)
    OR(status<>'REMOVED' AND encrypted_details IS NOT NULL AND bank_code IS NOT NULL AND bank_name IS NOT NULL AND account_last4 IS NOT NULL AND verified_at IS NOT NULL)),
 CHECK(status<>'APPROVED' OR(reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
-- IDs intentionally survive account deletion; no bank numbers/names enter the audit.
CREATE TABLE IF NOT EXISTS team_payment_details_audit (
 id bigserial PRIMARY KEY,
 admin_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 event text NOT NULL CHECK(event IN('SUBMITTED','APPROVED','REJECTED','REMOVED','REVEALED')),
 revision integer NOT NULL,
 reason text NOT NULL DEFAULT '' CHECK(length(reason)<=500),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_payment_review_queue ON team_payment_details(status,updated_at DESC,admin_id);
CREATE INDEX IF NOT EXISTS team_payment_audit_subject ON team_payment_details_audit(admin_id,created_at DESC);
