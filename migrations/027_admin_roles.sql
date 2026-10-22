-- Admin accounts belong to people, and people have jobs.
--
-- Until now an `admin_users` row was all-or-nothing: whoever held the password
-- could move money, approve partners, launch outreach and delete leads. That makes
-- the founder the only person who can approve an affiliate application at 11pm,
-- which is exactly the bottleneck this change removes.
--
-- Three roles, deliberately few:
--
--   owner              — everything, including creating other admins and moving money.
--   affiliate_manager  — the partner side: approve/decline, payouts, partner reports.
--   analyst            — read-only: the insights page and nothing that changes state.
--
-- Roles rather than per-permission flags because there are three jobs and a
-- permission matrix nobody would maintain. If a fourth job appears, add a role.

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner', 'affiliate_manager', 'analyst')),
  -- Soft disable, so somebody who leaves can be switched off without deleting the
  -- account and orphaning the broadcasts and payouts attributed to them.
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ,
  -- Who created this account, for the audit trail on a shared admin surface.
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Every existing admin keeps full access: they were created when 'owner' was the
-- only thing an admin could be.
UPDATE admin_users SET role = 'owner' WHERE role IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role) WHERE disabled_at IS NULL;

-- A disabled admin's sessions must die with the account. Cleaning them up on
-- disable is the caller's job, but the index makes that a cheap delete.
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_user_id);
