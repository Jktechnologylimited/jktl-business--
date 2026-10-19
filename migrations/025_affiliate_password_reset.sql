-- Self-serve password reset for partners.
--
-- The partner programme moved here from the marketing site, and password reset
-- came with it on the list of things that did not make the journey. Until now a
-- partner who forgot their password had to be reset by hand — tolerable at ten
-- partners and not at a hundred.
--
-- Four decisions worth recording, because a reset flow is the most attractive
-- surface in any authenticated app:
--
--  1. **The token is never stored.** Only its SHA-256 hash is. A database leak
--     that exposes these rows must not hand the attacker a working reset link,
--     and a plaintext token column would do exactly that. This is the same reason
--     passwords are hashed, and it is easy to skip by accident.
--
--  2. **Single use, and 30 minutes.** A reset link is a bearer credential; the
--     window it works in is the window an attacker has if it leaks out of an
--     inbox. Thirty minutes is enough for somebody to open their mail and long
--     enough to be inconvenient for anyone else. `used_at` makes a second use
--     impossible even inside the window.
--
--  3. **Requesting a new link kills the old ones.** Otherwise every request ever
--     made stays live, and a partner who clicks "resend" three times has three
--     working credentials.
--
--  4. **Rate limited per affiliate.** Without it, the form is a way to send
--     somebody's inbox an unbounded number of emails from our domain — which
--     damages a sending reputation that transactional mail depends on.

CREATE TABLE IF NOT EXISTS affiliate_password_resets (
  id UUID PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  -- SHA-256 of the token, hex. The token itself exists only in the email.
  token_hash TEXT NOT NULL UNIQUE,
  -- When it stops working. Short on purpose — see the note above.
  expires_at TIMESTAMPTZ NOT NULL,
  -- Set the moment it is used, so a link is single-use rather than
  -- time-limited-but-replayable.
  used_at TIMESTAMPTZ,
  -- When the new link was issued, so the previous ones can be invalidated in the
  -- same statement that creates it.
  superseded_at TIMESTAMPTZ,
  -- The originating IP, kept for an abuse investigation. Not used for enforcement.
  requested_ip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_password_resets_affiliate
  ON affiliate_password_resets(affiliate_id, created_at DESC);

-- The lookup on the reset page is by token hash, which the UNIQUE constraint
-- already indexes. This one is for the rate-limit count.
CREATE INDEX IF NOT EXISTS idx_affiliate_password_resets_recent
  ON affiliate_password_resets(affiliate_id, created_at) WHERE used_at IS NULL;

-- Cheap cleanup of expired rows from the cron; without an index that is a scan.
CREATE INDEX IF NOT EXISTS idx_affiliate_password_resets_expiry
  ON affiliate_password_resets(expires_at);
