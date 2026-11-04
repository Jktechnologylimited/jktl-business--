import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getSql } from "@/lib/db/client";
import { getSession } from "@/lib/session";
import { approvedPartner } from "@/lib/partners/access";
import {
  publicOrigin,
  settings,
  uuid,
  type Query,
  type BotRow,
  type ChatbotEntitlement,
} from "./model";
export const query: Query = (sql, params = []) => getSql().query(sql, params);
export const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const secret = () => randomBytes(32).toString("hex");
export async function actor(target?: unknown) {
  const requested = target ? uuid(target) : null,
    s = await getSession();
  if (s && (!requested || requested === s.organizationId)) {
    const membership = (
      await query(
        "SELECT role FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND active=true",
        [s.organizationId, s.userId],
      )
    )[0];
    if (membership && ["owner", "manager"].includes(String(membership.role)))
      return { org: s.organizationId, who: s.userId, manager: true };
    if (membership)
      return { org: s.organizationId, who: s.userId, manager: false };
  }
  if (!requested) throw Error("Sign in to manage your chatbot.");
  const partner = await approvedPartner();
  const allowed = await query(
    `SELECT 1 FROM partner_client_access a JOIN feature_registry f ON f.slug='ai-chatbot' WHERE a.organization_id=$1 AND a.partner_id=$2 AND a.revoked_at IS NULL AND 'MANAGE_CHATBOT'=ANY(a.scopes) AND f.partner_mode<>'UNAVAILABLE' AND 'MANAGE'=ANY(f.partner_actions)`,
    [requested, partner.id],
  );
  if (!allowed.length) throw Error("Client chatbot access is not authorized.");
  return { org: requested, who: "partner:" + partner.id, manager: true };
}
export async function botFor(org: string, id: string) {
  const bot = (
    await query(
      "SELECT * FROM chatbots WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL",
      [uuid(id), org],
    )
  )[0] as BotRow;
  if (!bot) throw Error("Chatbot not found.");
  return bot;
}
export async function limits(org: string) {
  return (
    await query("SELECT * FROM chatbot_limits($1)", [org])
  )[0] as ChatbotEntitlement;
}
export async function publicBot(id: string) {
  const bot = (
    await query(
      `SELECT b.* FROM chatbots b CROSS JOIN chatbot_settings c WHERE b.id=$1 AND b.enabled AND NOT b.suspended AND b.deleted_at IS NULL AND chatbot_eligible(b.id) AND c.id AND c.product_enabled`,
      [uuid(id)],
    )
  )[0] as BotRow;
  if (!bot) throw Error("CHATBOT_DISABLED");
  const entitlement = await limits(String(bot.organization_id));
  if (!entitlement?.enabled) throw Error("CHATBOT_DISABLED");
  return { ...bot, settings: settings(bot.settings), limits: entitlement };
}
export async function audit(
  org: string | null,
  who: string,
  event: string,
  detail: unknown = {},
) {
  await query(
    "INSERT INTO chatbot_audit(organization_id,actor,event,detail) VALUES($1,$2,$3,$4::jsonb)",
    [org, who, event, JSON.stringify(detail)],
  );
}
export async function rate(key: string, max: number, seconds = 60) {
  const rows = await query(
    `INSERT INTO chatbot_rates(key,count,expires_at) VALUES($1,1,now()+make_interval(secs=>$3)) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN chatbot_rates.expires_at<now() THEN 1 ELSE chatbot_rates.count+1 END,expires_at=CASE WHEN chatbot_rates.expires_at<now() THEN now()+make_interval(secs=>$3) ELSE chatbot_rates.expires_at END WHERE chatbot_rates.expires_at<now() OR chatbot_rates.count<$2 RETURNING count`,
    [key, max, seconds],
  );
  if (!rows.length) throw Error("RATE_LIMIT");
}
export async function requestRate(
  req: Request,
  bot: string,
  kind: string,
  max: number,
) {
  const cfg = (
    await query("SELECT rate_salt FROM chatbot_settings WHERE id")
  )[0];
  const ip = (
    req.headers.get("x-vercel-forwarded-for") ||
    req.headers.get("x-forwarded-for") ||
    "unknown"
  )
    .split(",")[0]
    .trim();
  await rate(hash(String(cfg.rate_salt) + ip + bot + kind), max);
  await rate("bot:" + bot + ":" + kind, max * 20);
}
export async function ticket(
  bot: string,
  source: string,
  kind: "embed" | "standalone",
) {
  const token = secret();
  await query(
    "INSERT INTO chatbot_tickets(token_hash,bot_id,origin,kind,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 minutes')",
    [hash(token), bot, source, kind],
  );
  return token;
}
export async function allowedOrigin(
  bot: Record<string, unknown>,
  source: string,
) {
  if (
    (
      await query(
        "SELECT 1 FROM chatbot_domains WHERE bot_id=$1 AND hostname=$2 AND verified_at>now()-interval '30 days'",
        [bot.id, new URL(source).hostname],
      )
    ).length
  )
    return true;
  if (!bot.install_on_builder) return false;
  const profile = (
    await query(
      "SELECT subdomain,custom_domain,custom_domain_verified,published FROM business_profiles WHERE organization_id=$1",
      [bot.organization_id],
    )
  )[0];
  return Boolean(
    profile?.published &&
    (source ===
      `https://${profile.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng"}` ||
      (profile.custom_domain_verified &&
        source === `https://${profile.custom_domain}`) ||
      source === publicOrigin()),
  );
}
export async function session(token: string) {
  if (!/^[a-f\d]{64}$/.test(token)) throw Error("CHAT_SESSION_EXPIRED");
  const row = (
    await query(
      "SELECT * FROM chatbot_sessions WHERE token_hash=$1 AND expires_at>now() AND delete_at>now() AND created_at>now()-make_interval(days=>(SELECT retention_days FROM chatbot_limits(organization_id)))",
      [hash(token)],
    )
  )[0];
  if (!row) throw Error("CHAT_SESSION_EXPIRED");
  const bot = await publicBot(String(row.bot_id));
  if (row.kind === "embed" && !(await allowedOrigin(bot, String(row.origin))))
    throw Error("ORIGIN_DENIED");
  return row;
}
export async function history(sessionId: string) {
  return query(
    "SELECT role,content,created_at FROM chatbot_messages WHERE session_id=$1 ORDER BY id DESC LIMIT 30",
    [sessionId],
  ).then((rows) => rows.reverse());
}
