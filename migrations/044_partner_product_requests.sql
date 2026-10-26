ALTER TABLE domain_audit DROP CONSTRAINT IF EXISTS domain_audit_actor_type_check;
ALTER TABLE domain_audit ADD CONSTRAINT domain_audit_actor_type_check CHECK(actor_type IN('admin','customer','partner','system'));
