ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check CHECK(role IN('owner','affiliate_manager','analyst','editor','support'));
CREATE TABLE IF NOT EXISTS support_cases(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 requester_id uuid NOT NULL REFERENCES users(id), subject text NOT NULL CHECK(length(subject) BETWEEN 3 AND 160),
 status text NOT NULL DEFAULT 'AI' CHECK(status IN('AI','WAITING','HUMAN','ESCALATED','RESOLVED')),
 assigned_to uuid REFERENCES admin_users(id), sensitive boolean NOT NULL DEFAULT false,
 consent_scopes text[] NOT NULL DEFAULT '{}', consent_until timestamptz, revision integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,organization_id)
);
CREATE INDEX IF NOT EXISTS support_case_queue ON support_cases(status,updated_at);
CREATE TABLE IF NOT EXISTS support_messages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL, organization_id uuid NOT NULL,
 sender text NOT NULL CHECK(sender IN('user','assistant','support','system')), actor_id text NOT NULL,
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 5000), guide_ids jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(case_id,organization_id) REFERENCES support_cases(id,organization_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS support_notes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES admin_users(id), body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS support_audit(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid REFERENCES support_cases(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, actor_id text NOT NULL,
 event text NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS support_rate_limits(key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS support_push_subscriptions(
 endpoint text PRIMARY KEY, admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
 session_id uuid NOT NULL REFERENCES admin_sessions(id) ON DELETE CASCADE,
 p256dh text NOT NULL, auth text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS support_outbox(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_key text NOT NULL UNIQUE,
 case_id uuid NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE,
 audience text NOT NULL CHECK(audience IN('staff','owner','customer')),
 delivered_at timestamptz, attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS business_reviews(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id), rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
 quote text NOT NULL CHECK(length(quote) BETWEEN 20 AND 1500), display_name text NOT NULL, company text NOT NULL,
 public_consent boolean NOT NULL DEFAULT false, consent_version text NOT NULL DEFAULT 'reviews-2026-01',
 milestone text NOT NULL CHECK(milestone IN('website','domain','customer')),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','PUBLISHED','REJECTED','WITHDRAWN')),
 moderated_by uuid REFERENCES admin_users(id), moderated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status<>'PUBLISHED' OR public_consent=true)
);
CREATE TABLE IF NOT EXISTS review_prompt_state(
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id), last_prompted_at timestamptz, dismissed_until timestamptz,
 PRIMARY KEY(organization_id,user_id)
);
CREATE TABLE IF NOT EXISTS review_audit(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), review_id uuid NOT NULL REFERENCES business_reviews(id) ON DELETE CASCADE,
 actor_id text NOT NULL, event text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS review_submission_windows(
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id),
 next_allowed_at timestamptz NOT NULL, PRIMARY KEY(organization_id,user_id)
);
INSERT INTO review_submission_windows(organization_id,user_id,next_allowed_at)
 SELECT organization_id,user_id,max(created_at)+interval '90 days' FROM business_reviews GROUP BY organization_id,user_id ON CONFLICT DO NOTHING;
