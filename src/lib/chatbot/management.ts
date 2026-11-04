import "server-only";
import { actor, audit, botFor, limits, query, secret } from "./store";
import {
  hostname,
  publicOrigin,
  settings,
  text,
  uuid,
  type BotRow,
} from "./model";
export async function dashboard(target?: unknown) {
  const a = await actor(target),
    ent = await limits(a.org);
  const bots = (await query(
    "SELECT * FROM chatbots WHERE organization_id=$1 AND deleted_at IS NULL ORDER BY created_at",
    [a.org],
  )) as BotRow[];
  const usage = (
    await query(
      "SELECT * FROM chatbot_usage WHERE organization_id=$1 AND period=date_trunc('month',now() AT TIME ZONE 'UTC')::date",
      [a.org],
    )
  )[0];
  const details = await Promise.all(
    bots.map(async (bot) => {
      const [knowledge, domains, sessions, leads, trends, questions] =
        await Promise.all([
          query(
            "SELECT id,title,content,enabled FROM chatbot_knowledge WHERE bot_id=$1 AND organization_id=$2 ORDER BY title",
            [bot.id, a.org],
          ),
          query(
            "SELECT * FROM chatbot_domains WHERE bot_id=$1 AND organization_id=$2 ORDER BY hostname",
            [bot.id, a.org],
          ),
          a.manager || ent.team_inbox
            ? query(
                "SELECT id,status,created_at FROM chatbot_sessions WHERE bot_id=$1 AND organization_id=$2 AND delete_at>now() AND created_at>now()-make_interval(days=>(SELECT retention_days FROM chatbot_limits(organization_id))) ORDER BY created_at DESC LIMIT 100",
                [bot.id, a.org],
              )
            : [],
          a.manager || ent.team_inbox
            ? query(
                "SELECT l.* FROM chatbot_leads l JOIN chatbot_sessions s ON s.id=l.session_id WHERE l.bot_id=$1 AND l.organization_id=$2 AND s.delete_at>now() AND s.created_at>now()-make_interval(days=>(SELECT retention_days FROM chatbot_limits(s.organization_id))) ORDER BY l.created_at DESC LIMIT 100",
                [bot.id, a.org],
              )
            : [],
          ent.analytics !== "basic"
            ? query(
                "SELECT date_trunc('day',created_at)::date AS day,count(*)::int AS conversations FROM chatbot_sessions WHERE bot_id=$1 AND organization_id=$2 AND delete_at>now() AND created_at>now()-make_interval(days=>(SELECT retention_days FROM chatbot_limits(organization_id))) GROUP BY 1 ORDER BY 1 DESC LIMIT 30",
                [bot.id, a.org],
              )
            : [],
          ent.analytics === "advanced"
            ? query(
                "SELECT left(m.content,160) AS question,count(*)::int AS count FROM chatbot_messages m JOIN chatbot_sessions s ON s.id=m.session_id WHERE m.bot_id=$1 AND m.organization_id=$2 AND m.role='user' AND s.delete_at>now() AND s.created_at>now()-make_interval(days=>(SELECT retention_days FROM chatbot_limits(s.organization_id))) GROUP BY 1 ORDER BY 2 DESC LIMIT 10",
                [bot.id, a.org],
              )
            : [],
        ]);
      return { ...bot, knowledge, domains, sessions, leads, trends, questions };
    }),
  );
  const config = (
    await query(
      "SELECT product_enabled,ai_enabled,model_verified,model FROM chatbot_settings WHERE id",
    )
  )[0];
  let deployed = false;
  try {
    const response = await fetch(publicOrigin() + "/chatbots/widget.js", {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    deployed = response.ok && response.headers.get("x-jktl-widget") === "1";
  } catch {}
  const projects = await query(
    "SELECT id,name FROM custom_projects WHERE organization_id=$1 AND managed_cms=true AND status='LIVE'",
    [a.org],
  );
  return {
    projects,
    actor: a,
    entitlements: ent,
    bots: details,
    usage: usage || { completed: 0 },
    productEnabled: Boolean(config?.product_enabled),
    providerReady: Boolean(
      process.env.DEEPSEEK_API_KEY &&
      config?.ai_enabled &&
      config.model_verified &&
      config.model,
    ),
    origin: publicOrigin(),
    widgetDeployed: deployed,
  };
}
export async function change(
  target: unknown,
  operation: string,
  input: Record<string, unknown>,
) {
  const a = await actor(target);
  if (!a.manager)
    throw Error("An owner or manager must approve chatbot changes.");
  if (operation === "create") {
    const slug = text(input.slug, 60, true).toLowerCase();
    if (
      !/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug) ||
      ["admin", "api", "widget", "business", "support", "jktl"].includes(slug)
    )
      throw Error("Choose an available public slug.");
    const created = (
      await query("SELECT * FROM chatbot_create($1,$2,$3,$4)", [
        a.org,
        slug,
        text(input.name, 80, true),
        a.who,
      ])
    )[0];
    return { id: created.id };
  }
  const bot = await botFor(a.org, uuid(input.botId)),
    ent = await limits(a.org);
  if (operation === "settings") {
    const value = settings(input.settings);
    if (
      value.customProjectId &&
      !(
        await query(
          "SELECT 1 FROM custom_projects WHERE id=$1 AND organization_id=$2 AND status='LIVE' AND managed_cms=true",
          [value.customProjectId, a.org],
        )
      ).length
    )
      throw Error("Custom website is not authorized.");
    if (!ent.remove_branding) value.hideBranding = false;
    if (ent.branding === "basic") value.avatar = "";
    const rows = await query(
      "UPDATE chatbots SET name=$3,settings=$4::jsonb,enabled=$5,revision=revision+1,updated_at=now() WHERE id=$1 AND organization_id=$2 AND revision=$6 RETURNING id",
      [
        bot.id,
        a.org,
        text(input.name, 80, true),
        JSON.stringify(value),
        input.enabled === true,
        Number(input.revision),
      ],
    );
    if (!rows.length)
      throw Error("Reload: this chatbot changed in another session.");
  } else if (operation === "knowledge")
    await query("SELECT chatbot_save_knowledge($1,$2,$3,$4,$5)", [
      a.org,
      bot.id,
      input.id ? uuid(input.id) : null,
      text(input.title, 160, true),
      text(input.content, 4000, true),
    ]);
  else if (operation === "deleteKnowledge")
    await query(
      "DELETE FROM chatbot_knowledge WHERE id=$1 AND bot_id=$2 AND organization_id=$3",
      [uuid(input.id), bot.id, a.org],
    );
  else if (operation === "domain")
    await query(
      "INSERT INTO chatbot_domains(bot_id,organization_id,hostname,verification_token) VALUES($1,$2,$3,$4) ON CONFLICT(bot_id,hostname) DO NOTHING",
      [bot.id, a.org, hostname(input.hostname), "jktl-chatbot=" + secret()],
    );
  else if (operation === "removeDomain")
    await query(
      "DELETE FROM chatbot_domains WHERE id=$1 AND bot_id=$2 AND organization_id=$3",
      [uuid(input.id), bot.id, a.org],
    );
  else if (operation === "verifyDomain") {
    const domain = (
      await query(
        "SELECT * FROM chatbot_domains WHERE id=$1 AND bot_id=$2 AND organization_id=$3",
        [uuid(input.id), bot.id, a.org],
      )
    )[0];
    if (!domain) throw Error("Domain not found.");
    const name = "_jktl-chatbot." + domain.hostname;
    // Public DNS only. No visitor-supplied website URL is fetched.
    let records: string[] = [];
    if (!records.includes(String(domain.verification_token))) {
      try {
        const response = await fetch(
          "https://dns.google/resolve?name=" +
            encodeURIComponent(name) +
            "&type=TXT",
          { signal: AbortSignal.timeout(5000), cache: "no-store" },
        );
        const result = await response.json();
        records = (result.Answer || [])
          .filter((r: { type: number }) => r.type === 16)
          .map((r: { data: string }) =>
            r.data.replace(/"\s*"/g, "").replace(/^"|"$/g, ""),
          );
      } catch {}
    }
    if (!records.includes(String(domain.verification_token)))
      throw Error(
        "The TXT record is not visible yet. Check the hostname and value, then try again.",
      );
    await query(
      "UPDATE chatbot_domains SET verified_at=now() WHERE id=$1 AND bot_id=$2 AND organization_id=$3",
      [domain.id, bot.id, a.org],
    );
  } else if (operation === "builder") {
    const enable = input.enabled === true;
    await query("SELECT chatbot_select_builder($1,$2,$3)", [
      a.org,
      bot.id,
      enable,
    ]);
  } else if (operation === "deleteConversation")
    await query(
      "DELETE FROM chatbot_sessions WHERE id=$1 AND bot_id=$2 AND organization_id=$3",
      [uuid(input.id), bot.id, a.org],
    );
  else if (operation === "leadStatus") {
    if (!["OPEN", "CONTACTED", "CLOSED"].includes(String(input.status)))
      throw Error("Choose a valid lead status.");
    await query(
      "UPDATE chatbot_leads SET status=$4 WHERE id=$1 AND bot_id=$2 AND organization_id=$3",
      [uuid(input.id), bot.id, a.org, input.status],
    );
  } else if (operation === "deleteBot")
    await query(
      "WITH removed AS(DELETE FROM chatbot_sessions WHERE bot_id=$1 AND organization_id=$2 RETURNING id) UPDATE chatbots SET deleted_at=now(),enabled=false,install_on_builder=false WHERE id=$1 AND organization_id=$2",
      [bot.id, a.org],
    );
  else throw Error("Unsupported chatbot action.");
  await audit(a.org, a.who, "BOT_" + operation.toUpperCase(), { bot: bot.id });
  return { ok: true };
}
export async function conversation(
  target: unknown,
  botId: string,
  sessionId: string,
) {
  const a = await actor(target),
    ent = await limits(a.org);
  await botFor(a.org, botId);
  if (!a.manager && !ent.team_inbox)
    throw Error("Team inbox is not included in this plan.");
  const exists = await query(
    "SELECT 1 FROM chatbot_sessions WHERE id=$1 AND bot_id=$2 AND organization_id=$3 AND delete_at>now() AND created_at>now()-make_interval(days=>(SELECT retention_days FROM chatbot_limits(organization_id)))",
    [uuid(sessionId), uuid(botId), a.org],
  );
  if (!exists.length) throw Error("Conversation not found.");
  await audit(a.org, a.who, "CONVERSATION_VIEWED", { session: sessionId });
  return query(
    "SELECT role,content,created_at FROM chatbot_messages WHERE session_id=$1 AND bot_id=$2 AND organization_id=$3 ORDER BY id",
    [sessionId, botId, a.org],
  );
}
export async function reply(
  target: unknown,
  botId: string,
  sessionId: string,
  message: string,
) {
  const a = await actor(target),
    ent = await limits(a.org);
  if (!ent.team_inbox) throw Error("Team replies require an eligible plan.");
  await botFor(a.org, botId);
  const rows = await query(
    `INSERT INTO chatbot_messages(session_id,bot_id,organization_id,role,content) SELECT id,bot_id,organization_id,'human',$4 FROM chatbot_sessions WHERE id=$1 AND bot_id=$2 AND organization_id=$3 AND delete_at>now() AND created_at>now()-make_interval(days=>(SELECT retention_days FROM chatbot_limits(organization_id))) RETURNING id`,
    [uuid(sessionId), uuid(botId), a.org, text(message, 2000, true)],
  );
  if (!rows.length) throw Error("Conversation not found.");
  await audit(a.org, a.who, "HUMAN_REPLY", { session: sessionId });
}
