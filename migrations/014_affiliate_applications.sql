-- Self-serve affiliate applications. Previously every affiliate account was
-- created directly by the command center (migration 012's comment: "There
-- is no public affiliate signup"). That's changed: an interested person can
-- now apply themselves at /affiliates/apply, but they land in a new
-- 'pending' status (see src/lib/db/affiliates.ts's `applyAsAffiliate`) and
-- can't sign in or earn anything until an admin approves them from the
-- command center (Admin → Affiliates). An admin-created affiliate (the
-- original flow, still available) is unaffected — it still goes straight
-- to 'active', no review step, since the admin creating it *is* the review.
--
-- No new status column needed — migration 012's `status TEXT NOT NULL
-- DEFAULT 'active'` was never constrained by a CHECK, just a comment, so
-- 'pending' is simply a new value the same column already accepts. A
-- rejected application is deleted outright rather than kept in a
-- 'rejected' state — there's nothing useful to retain about an application
-- nobody approved, and it lets the same email apply again later.
ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS application_note TEXT NOT NULL DEFAULT '';
