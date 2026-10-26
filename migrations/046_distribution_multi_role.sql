-- One Business identity can hold separately approved program profiles. Preserve
-- all existing profile IDs, passwords, referral codes and earnings.
ALTER TABLE affiliates DROP CONSTRAINT IF EXISTS affiliates_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_program_email_unique ON affiliates(email,programme);
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_id_program_unique ON affiliates(id,programme);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='distribution_link_program_fkey' AND conrelid='distribution_account_links'::regclass) THEN
 ALTER TABLE distribution_account_links ADD CONSTRAINT distribution_link_program_fkey FOREIGN KEY(affiliate_id,program) REFERENCES affiliates(id,programme) NOT VALID;
 END IF;
END $$;
