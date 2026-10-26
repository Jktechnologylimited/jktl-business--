CREATE TABLE IF NOT EXISTS partner_support_settings(id boolean PRIMARY KEY DEFAULT true CHECK(id),response_hours int NOT NULL DEFAULT 48 CHECK(response_hours BETWEEN 1 AND 720),updated_by text,updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO partner_support_settings(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS partner_notice_outbox(id bigserial PRIMARY KEY,event_key text NOT NULL UNIQUE,ticket_id uuid NOT NULL REFERENCES partner_tickets(id),audience text NOT NULL CHECK(audience IN('PARTNER','STAFF')),created_at timestamptz NOT NULL DEFAULT now(),delivered_at timestamptz,attempts int NOT NULL DEFAULT 0,lease_until timestamptz);
CREATE OR REPLACE FUNCTION queue_partner_ticket_notice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.kind IN('PARTNER','STAFF') OR(NEW.kind='EVENT' AND NEW.body='Staff assignment updated') THEN
 INSERT INTO partner_notice_outbox(event_key,ticket_id,audience) VALUES('message-'||NEW.id,NEW.ticket_id,CASE WHEN NEW.kind='PARTNER' THEN 'STAFF' ELSE 'PARTNER' END) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS partner_message_notice ON partner_ticket_messages;
CREATE TRIGGER partner_message_notice AFTER INSERT ON partner_ticket_messages FOR EACH ROW EXECUTE FUNCTION queue_partner_ticket_notice();
CREATE TABLE IF NOT EXISTS partner_push_subscriptions(endpoint text PRIMARY KEY,affiliate_id uuid NOT NULL REFERENCES affiliates(id),session_id uuid NOT NULL REFERENCES affiliate_sessions(id) ON DELETE CASCADE,p256dh text NOT NULL,auth text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS partner_ticket_attachments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES partner_tickets(id),actor_id text NOT NULL,file_name text NOT NULL,mime text NOT NULL CHECK(mime IN('image/png','image/jpeg','image/webp','application/pdf')),size int NOT NULL CHECK(size BETWEEN 1 AND 524288),body text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE partner_tickets ADD COLUMN IF NOT EXISTS attachment_bytes integer NOT NULL DEFAULT 0 CHECK(attachment_bytes BETWEEN 0 AND 5242880);

CREATE INDEX IF NOT EXISTS partner_notice_pending ON partner_notice_outbox(created_at) WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS partner_ticket_profile ON partner_tickets(partner_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS partner_message_history ON partner_ticket_messages(ticket_id,id);
CREATE INDEX IF NOT EXISTS partner_attachment_ticket ON partner_ticket_attachments(ticket_id);
