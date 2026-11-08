-- Prospective website commission amendments. Issued contracts and earned ledger rows remain intact.
CREATE TABLE IF NOT EXISTS partner_commission_changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 affiliate_id uuid NOT NULL REFERENCES affiliates(id),
 contract_id uuid REFERENCES distribution_contracts(id),
 previous_bps integer NOT NULL CHECK(previous_bps BETWEEN 0 AND 10000),
 rate_bps integer NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000),
 reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 3000),
 changed_by text NOT NULL,
 effective_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS partner_commission_changes_lookup ON partner_commission_changes(affiliate_id,contract_id,effective_at DESC,id DESC);
CREATE OR REPLACE FUNCTION partner_commission_change_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Commission amendments are immutable; record a new change'; END $$;
DROP TRIGGER IF EXISTS partner_commission_change_immutable ON partner_commission_changes;
CREATE TRIGGER partner_commission_change_immutable BEFORE UPDATE OR DELETE ON partner_commission_changes FOR EACH ROW EXECUTE FUNCTION partner_commission_change_immutable();
