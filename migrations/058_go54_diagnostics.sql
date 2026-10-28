-- Private provider evidence only. No customer record or payment mutation.
CREATE TABLE IF NOT EXISTS domain_registrar_diagnostics (
 id uuid PRIMARY KEY,actor_id uuid NOT NULL REFERENCES admin_users(id),
 operation text NOT NULL,method text NOT NULL CHECK(method IN('GET','POST')),
 http_status integer CHECK(http_status BETWEEN 100 AND 599),json_valid boolean NOT NULL,
 sanitized_payload jsonb NOT NULL,observed_at timestamptz NOT NULL,captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS domain_registrar_diagnostics_recent ON domain_registrar_diagnostics(captured_at DESC);
