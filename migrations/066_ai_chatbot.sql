-- General website chatbot product. Clinical receptionist sessions remain separate.
CREATE TABLE IF NOT EXISTS chatbot_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), product_enabled boolean NOT NULL DEFAULT true,
 ai_enabled boolean NOT NULL DEFAULT false, model text NOT NULL DEFAULT '', model_verified boolean NOT NULL DEFAULT false,
 input_usd_per_million numeric(14,6), output_usd_per_million numeric(14,6),
 daily_cap_micro_usd bigint NOT NULL DEFAULT 100000000 CHECK(daily_cap_micro_usd>=0),
 max_output_tokens int NOT NULL DEFAULT 512 CHECK(max_output_tokens BETWEEN 64 AND 2048),
 rate_salt text NOT NULL DEFAULT replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''), updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO chatbot_settings(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS chatbot_entitlements (
 plan_id text PRIMARY KEY CHECK(plan_id IN('free','starter','growth','business','elite')),
 enabled boolean NOT NULL DEFAULT true, bots int NOT NULL CHECK(bots BETWEEN 0 AND 100),
 responses int NOT NULL CHECK(responses BETWEEN 0 AND 100000), knowledge int NOT NULL CHECK(knowledge BETWEEN 0 AND 5000),
 retention_days int NOT NULL CHECK(retention_days BETWEEN 1 AND 365), appointments boolean NOT NULL DEFAULT false,
 team_inbox boolean NOT NULL DEFAULT false, remove_branding boolean NOT NULL DEFAULT false,
 advanced_leads boolean NOT NULL DEFAULT false, analytics text NOT NULL CHECK(analytics IN('basic','standard','advanced')),
 branding text NOT NULL CHECK(branding IN('basic','standard','advanced')),
 monthly_cap_micro_usd bigint NOT NULL CHECK(monthly_cap_micro_usd>=0)
);
INSERT INTO chatbot_entitlements VALUES
('free',true,1,100,20,7,false,false,false,false,'basic','basic',1000000),
('starter',true,1,500,50,30,true,false,false,true,'standard','standard',5000000),
('growth',true,5,3000,500,90,true,true,true,true,'advanced','advanced',20000000),
('business',true,5,3000,500,90,true,true,true,true,'advanced','advanced',20000000),
('elite',true,5,3000,500,90,true,true,true,true,'advanced','advanced',20000000)
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS chatbots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
 slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9][a-z0-9-]{2,59}$'), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 settings jsonb NOT NULL DEFAULT '{}', enabled boolean NOT NULL DEFAULT true, suspended boolean NOT NULL DEFAULT false,
 install_on_builder boolean NOT NULL DEFAULT false, conversations_count bigint NOT NULL DEFAULT 0, leads_count bigint NOT NULL DEFAULT 0, handoffs_count bigint NOT NULL DEFAULT 0, deleted_at timestamptz, revision int NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,organization_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_builder_chatbot ON chatbots(organization_id) WHERE install_on_builder AND deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS chatbot_knowledge (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bot_id uuid NOT NULL, organization_id uuid NOT NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160), content text NOT NULL CHECK(length(content) BETWEEN 1 AND 4000),
 enabled boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(bot_id,organization_id) REFERENCES chatbots(id,organization_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS chatbot_domains (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bot_id uuid NOT NULL, organization_id uuid NOT NULL,
 hostname text NOT NULL, verification_token text NOT NULL, verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(bot_id,hostname),
 FOREIGN KEY(bot_id,organization_id) REFERENCES chatbots(id,organization_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS chatbot_tickets (
 token_hash text PRIMARY KEY, bot_id uuid NOT NULL REFERENCES chatbots(id), origin text NOT NULL,
 kind text NOT NULL CHECK(kind IN('embed','standalone')), expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS chatbot_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bot_id uuid NOT NULL, organization_id uuid NOT NULL,
 token_hash text NOT NULL UNIQUE, origin text NOT NULL, kind text NOT NULL DEFAULT 'standalone' CHECK(kind IN('standalone','embed')), status text NOT NULL DEFAULT 'active' CHECK(status IN('active','human')),
 pending_turn uuid, expires_at timestamptz NOT NULL, delete_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,bot_id,organization_id),
 FOREIGN KEY(bot_id,organization_id) REFERENCES chatbots(id,organization_id)
);
CREATE TABLE IF NOT EXISTS chatbot_usage (
 organization_id uuid NOT NULL REFERENCES organizations(id), period date NOT NULL,
 completed int NOT NULL DEFAULT 0, cost_micro_usd bigint NOT NULL DEFAULT 0,
 PRIMARY KEY(organization_id,period)
);
CREATE TABLE IF NOT EXISTS chatbot_daily (
 day date PRIMARY KEY, actual_micro_usd bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS chatbot_turns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid REFERENCES chatbot_sessions(id) ON DELETE SET NULL,
 bot_id uuid NOT NULL REFERENCES chatbots(id), organization_id uuid NOT NULL REFERENCES organizations(id),
 request_key uuid NOT NULL, period date NOT NULL, day date NOT NULL,
 state text NOT NULL CHECK(state IN('pending','completed','fallback','uncertain','failed')),
 reserved_micro_usd bigint NOT NULL DEFAULT 0, ai_reserved boolean NOT NULL DEFAULT false,
 actual_micro_usd bigint, tokens_in int, tokens_out int, model text, error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 UNIQUE(session_id,request_key)
);
CREATE TABLE IF NOT EXISTS chatbot_messages (
 id bigserial PRIMARY KEY, session_id uuid NOT NULL, bot_id uuid NOT NULL, organization_id uuid NOT NULL,
 turn_id uuid REFERENCES chatbot_turns(id) ON DELETE SET NULL,
 role text NOT NULL CHECK(role IN('user','assistant','human')), content text NOT NULL CHECK(length(content) BETWEEN 1 AND 10000),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(session_id,bot_id,organization_id) REFERENCES chatbot_sessions(id,bot_id,organization_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS chatbot_messages_session ON chatbot_messages(session_id,id);
CREATE INDEX IF NOT EXISTS chatbot_turns_budget ON chatbot_turns(organization_id,period,state);
CREATE TABLE IF NOT EXISTS chatbot_leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL, bot_id uuid NOT NULL, organization_id uuid NOT NULL,
 request_key uuid NOT NULL, kind text NOT NULL CHECK(kind IN('enquiry','handoff','appointment')), name text NOT NULL, email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
 enquiry text NOT NULL, marketing_consent boolean NOT NULL DEFAULT false, consent_at timestamptz NOT NULL DEFAULT now(),
 appointment jsonb NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','CONTACTED','CLOSED')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(session_id,request_key),
 FOREIGN KEY(session_id,bot_id,organization_id) REFERENCES chatbot_sessions(id,bot_id,organization_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS chatbot_notice_outbox (
 id bigserial PRIMARY KEY, lead_id uuid NOT NULL UNIQUE REFERENCES chatbot_leads(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES organizations(id), attempts int NOT NULL DEFAULT 0, lease_until timestamptz,
 email_sent_at timestamptz,push_sent_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chatbot_audit (
 id bigserial PRIMARY KEY, organization_id uuid REFERENCES organizations(id), actor text NOT NULL, event text NOT NULL,
 detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chatbot_rates (key text PRIMARY KEY,count int NOT NULL,expires_at timestamptz NOT NULL);
CREATE OR REPLACE FUNCTION chatbot_limits(p_org uuid) RETURNS chatbot_entitlements LANGUAGE sql STABLE AS $$
 SELECT e.* FROM chatbot_entitlements e WHERE e.plan_id=coalesce((SELECT plan_id FROM website_plan_subscriptions
 WHERE organization_id=p_org AND period_end>now() AND status IN('active','past_due','cancelled') LIMIT 1),'free')
$$;
CREATE OR REPLACE FUNCTION chatbot_create(p_org uuid,p_slug text,p_name text,p_actor text) RETURNS chatbots LANGUAGE plpgsql AS $$
DECLARE limits chatbot_entitlements; result chatbots;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_org::text,661));
 SELECT * INTO limits FROM chatbot_limits(p_org);
 IF NOT limits.enabled OR NOT (SELECT product_enabled FROM chatbot_settings WHERE id) THEN RAISE EXCEPTION 'CHATBOT_DISABLED'; END IF;
 IF (SELECT count(*) FROM chatbots WHERE organization_id=p_org AND deleted_at IS NULL)>=limits.bots THEN RAISE EXCEPTION 'CHATBOT_LIMIT'; END IF;
 INSERT INTO chatbots(organization_id,slug,name) VALUES(p_org,p_slug,p_name) RETURNING * INTO result;
 INSERT INTO chatbot_audit(organization_id,actor,event,detail) VALUES(p_org,p_actor,'BOT_CREATED',jsonb_build_object('bot',result.id));
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION chatbot_save_knowledge(p_org uuid,p_bot uuid,p_id uuid,p_title text,p_content text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE limits chatbot_entitlements; result uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_org::text,662));
 IF NOT EXISTS(SELECT 1 FROM chatbots WHERE id=p_bot AND organization_id=p_org AND deleted_at IS NULL) THEN RAISE EXCEPTION 'CHATBOT_NOT_FOUND'; END IF;
 SELECT * INTO limits FROM chatbot_limits(p_org);
 IF p_id IS NULL THEN
  IF (SELECT count(*) FROM chatbot_knowledge WHERE bot_id=p_bot)>=limits.knowledge THEN RAISE EXCEPTION 'KNOWLEDGE_LIMIT'; END IF;
  INSERT INTO chatbot_knowledge(bot_id,organization_id,title,content) VALUES(p_bot,p_org,p_title,p_content) RETURNING id INTO result;
 ELSE
  UPDATE chatbot_knowledge SET title=p_title,content=p_content,updated_at=now() WHERE id=p_id AND bot_id=p_bot AND organization_id=p_org RETURNING id INTO result;
  IF result IS NULL THEN RAISE EXCEPTION 'CHATBOT_NOT_FOUND'; END IF;
 END IF;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION chatbot_begin(p_token_hash text,p_request uuid,p_question text,p_use_ai boolean,p_reserve bigint)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE s chatbot_sessions; bot chatbots; limits chatbot_entitlements; cfg chatbot_settings; u chatbot_usage; d chatbot_daily; t chatbot_turns;
 month_key date:=date_trunc('month',now() AT TIME ZONE 'UTC')::date; day_key date:=(now() AT TIME ZONE 'UTC')::date;
 busy_count int; outstanding bigint; global_outstanding bigint; allow_ai boolean:=false;
BEGIN
 SELECT * INTO s FROM chatbot_sessions WHERE token_hash=p_token_hash AND expires_at>now() AND delete_at>now();
 IF s.id IS NULL THEN RAISE EXCEPTION 'CHAT_SESSION_EXPIRED'; END IF;
 INSERT INTO chatbot_daily(day) VALUES(day_key) ON CONFLICT DO NOTHING;
 SELECT * INTO d FROM chatbot_daily WHERE day=day_key FOR UPDATE;
 INSERT INTO chatbot_usage(organization_id,period) VALUES(s.organization_id,month_key) ON CONFLICT DO NOTHING;
 SELECT * INTO u FROM chatbot_usage WHERE organization_id=s.organization_id AND period=month_key FOR UPDATE;
 SELECT * INTO s FROM chatbot_sessions WHERE id=s.id FOR UPDATE;
 SELECT * INTO bot FROM chatbots WHERE id=s.bot_id AND enabled AND NOT suspended AND deleted_at IS NULL;
 SELECT * INTO cfg FROM chatbot_settings WHERE id;
 SELECT * INTO limits FROM chatbot_limits(s.organization_id);
 IF bot.id IS NULL OR NOT chatbot_eligible(bot.id) OR NOT cfg.product_enabled OR NOT limits.enabled THEN RAISE EXCEPTION 'CHATBOT_DISABLED'; END IF;
 SELECT * INTO t FROM chatbot_turns WHERE session_id=s.id AND request_key=p_request;
 IF t.id IS NOT NULL THEN RETURN jsonb_build_object('id',t.id,'state',t.state,'replay',true); END IF;
 UPDATE chatbot_turns SET state='uncertain',error_code='LEASE_EXPIRED',finished_at=now() WHERE session_id=s.id AND state='pending' AND created_at<now()-interval '2 minutes';
 IF EXISTS(SELECT 1 FROM chatbot_turns WHERE session_id=s.id AND state='pending') THEN RAISE EXCEPTION 'CHAT_BUSY'; END IF;
 IF (SELECT count(*) FROM chatbot_turns WHERE session_id=s.id)>=80 THEN RAISE EXCEPTION 'CHAT_SESSION_LIMIT'; END IF;
 SELECT count(*) FILTER(WHERE state='pending'),coalesce(sum(reserved_micro_usd) FILTER(WHERE state IN('pending','uncertain') OR state='completed' AND actual_micro_usd IS NULL),0)
 INTO busy_count,outstanding FROM chatbot_turns WHERE organization_id=s.organization_id AND period=month_key;
 SELECT coalesce(sum(reserved_micro_usd),0) INTO global_outstanding FROM chatbot_turns WHERE day=day_key AND(state IN('pending','uncertain') OR state='completed' AND actual_micro_usd IS NULL);
 allow_ai:=p_use_ai AND s.status='active' AND cfg.ai_enabled AND cfg.model_verified AND length(cfg.model)>0
  AND cfg.input_usd_per_million IS NOT NULL AND cfg.output_usd_per_million IS NOT NULL
  AND u.completed+busy_count<limits.responses AND p_reserve>0
  AND u.cost_micro_usd+outstanding+p_reserve<=limits.monthly_cap_micro_usd
  AND d.actual_micro_usd+global_outstanding+p_reserve<=cfg.daily_cap_micro_usd;
 INSERT INTO chatbot_turns(session_id,bot_id,organization_id,request_key,period,day,state,ai_reserved,reserved_micro_usd)
 VALUES(s.id,s.bot_id,s.organization_id,p_request,month_key,day_key,'pending',allow_ai,CASE WHEN allow_ai THEN p_reserve ELSE 0 END) RETURNING * INTO t;
 INSERT INTO chatbot_messages(session_id,bot_id,organization_id,turn_id,role,content) VALUES(s.id,s.bot_id,s.organization_id,t.id,'user',p_question);
 UPDATE chatbot_sessions SET pending_turn=t.id WHERE id=s.id;
 RETURN jsonb_build_object('id',t.id,'state',t.state,'ai',allow_ai,'replay',false);
END $$;
CREATE OR REPLACE FUNCTION chatbot_finish(p_turn uuid,p_state text,p_reply text,p_in int,p_out int,p_cost bigint,p_model text,p_error text)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE t chatbot_turns;
BEGIN
 SELECT * INTO t FROM chatbot_turns WHERE id=p_turn;
 IF t.id IS NULL THEN RETURN false; END IF;
 PERFORM 1 FROM chatbot_daily WHERE day=t.day FOR UPDATE;
 PERFORM 1 FROM chatbot_usage WHERE organization_id=t.organization_id AND period=t.period FOR UPDATE;
 SELECT * INTO t FROM chatbot_turns WHERE id=p_turn FOR UPDATE;
 IF t.state<>'pending' THEN RETURN false; END IF;
 IF p_state NOT IN('completed','fallback','uncertain','failed') OR(p_state='completed' AND NOT t.ai_reserved) THEN RAISE EXCEPTION 'INVALID_TURN_STATE'; END IF;
 UPDATE chatbot_turns SET state=p_state,actual_micro_usd=CASE WHEN p_state='completed' THEN p_cost END,tokens_in=p_in,tokens_out=p_out,model=p_model,error_code=p_error,finished_at=now()
 WHERE id=t.id;
 IF p_state='completed' THEN
  UPDATE chatbot_usage SET completed=completed+1,cost_micro_usd=cost_micro_usd+coalesce(p_cost,0) WHERE organization_id=t.organization_id AND period=t.period;
  UPDATE chatbot_daily SET actual_micro_usd=actual_micro_usd+coalesce(p_cost,0) WHERE day=t.day;
 END IF;
 IF length(p_reply)>0 AND EXISTS(SELECT 1 FROM chatbot_sessions WHERE id=t.session_id AND delete_at>now()) THEN
  INSERT INTO chatbot_messages(session_id,bot_id,organization_id,turn_id,role,content) VALUES(t.session_id,t.bot_id,t.organization_id,t.id,'assistant',p_reply);
 END IF;
 UPDATE chatbot_sessions SET pending_turn=NULL WHERE id=t.session_id AND pending_turn=t.id;
 RETURN true;
END $$;
INSERT INTO feature_registry(slug,name,category,route,description,is_new,partner_mode,partner_actions)
VALUES('ai-chatbot','JKTL AI Chatbot','Product','/business/chatbot','Free-to-start website conversations, knowledge and enquiries.',true,'SELF_SERVICE',ARRAY['VIEW','CONFIGURE','MANAGE','REQUEST_SUPPORT']) ON CONFLICT DO NOTHING;
ALTER TABLE partner_client_access DROP CONSTRAINT IF EXISTS partner_client_access_scopes_check;
ALTER TABLE partner_client_access ADD CONSTRAINT partner_client_access_scopes_check CHECK(scopes <@ ARRAY['VIEW_ALLOWED_SERVICES','REQUEST_SERVICE_CHANGES','MANAGE_WEBSITE_CONTENT','PUBLISH_WEBSITE','PURCHASE_DOMAINS','MANAGE_CHATBOT']::text[]);
CREATE TABLE IF NOT EXISTS chatbot_org_caps (
 organization_id uuid PRIMARY KEY REFERENCES organizations(id),monthly_cap_micro_usd bigint NOT NULL CHECK(monthly_cap_micro_usd>=0)
);
CREATE OR REPLACE FUNCTION chatbot_limits(p_org uuid) RETURNS chatbot_entitlements LANGUAGE plpgsql STABLE AS $$
DECLARE result chatbot_entitlements; cap bigint;
BEGIN
 SELECT e.* INTO result FROM chatbot_entitlements e WHERE e.plan_id=coalesce((SELECT plan_id FROM website_plan_subscriptions WHERE organization_id=p_org AND period_end>now() AND status IN('active','past_due','cancelled') LIMIT 1),'free');
 SELECT monthly_cap_micro_usd INTO cap FROM chatbot_org_caps WHERE organization_id=p_org;
 IF cap IS NOT NULL THEN result.monthly_cap_micro_usd:=cap; END IF;
 RETURN result;
END $$;

-- One selected builder assistant, changed in a defined order under an org lock.
CREATE OR REPLACE FUNCTION chatbot_select_builder(p_org uuid,p_bot uuid,p_enabled boolean)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_org::text,661));
 IF NOT EXISTS(SELECT 1 FROM chatbots WHERE id=p_bot AND organization_id=p_org AND deleted_at IS NULL) THEN RAISE EXCEPTION 'CHATBOT_NOT_FOUND'; END IF;
 UPDATE chatbots SET install_on_builder=false WHERE organization_id=p_org AND id<>p_bot AND install_on_builder;
 UPDATE chatbots SET install_on_builder=p_enabled,updated_at=now() WHERE id=p_bot AND organization_id=p_org;
END $$;

-- Downgrades cannot leave five public assistants active on a one-assistant plan.
CREATE OR REPLACE FUNCTION chatbot_eligible(p_bot uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM chatbots b WHERE b.id=p_bot AND b.enabled AND NOT b.suspended AND b.deleted_at IS NULL
 AND b.id IN(SELECT c.id FROM chatbots c WHERE c.organization_id=b.organization_id AND c.enabled AND NOT c.suspended AND c.deleted_at IS NULL ORDER BY c.created_at,c.id LIMIT (SELECT bots FROM chatbot_limits(b.organization_id))))
$$;

CREATE INDEX IF NOT EXISTS chatbot_sessions_retention ON chatbot_sessions(organization_id,created_at);
CREATE INDEX IF NOT EXISTS chatbot_turns_daily ON chatbot_turns(day,state);
CREATE INDEX IF NOT EXISTS chatbot_knowledge_lookup ON chatbot_knowledge(bot_id,updated_at DESC);
