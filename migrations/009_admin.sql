-- The JKTL "command center" — a superadmin view across every business
-- account on the platform. Deliberately its own two tables with NO
-- foreign key into `users`/`organizations`/`sessions` at all: a command-
-- center login is not a business account with extra privileges, it's a
-- completely separate credential, so a leak of one can never touch the
-- other, and revoking every admin session can never sign a business owner
-- out. There is no public signup for this — the only way to create or
-- reset an admin account is `npm run admin:create` from a terminal with
-- database access (see scripts/create-admin.mjs), same trust boundary as
-- DATABASE_URL itself.

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Same DB-backed-session shape as `sessions`, kept in its own table so an
-- admin session can never be confused with (or accidentally validated
-- against) a business one.
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_user_id);
