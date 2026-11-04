"use server";
import { requireAdminCapability } from "@/lib/admin-session";
import { audit, query } from "@/lib/chatbot/store";
import { text, uuid } from "@/lib/chatbot/model";
import { WEBSITE_PLANS } from "@/lib/website-pricing";
export async function chatbotAdminHome() {
  await requireAdminCapability("manage_chatbots");
  const [settings, entitlements, bots, usage, errors] = await Promise.all([
    query(
      "SELECT product_enabled,ai_enabled,model,model_verified,input_usd_per_million,output_usd_per_million,daily_cap_micro_usd,max_output_tokens FROM chatbot_settings WHERE id",
    ),
    query("SELECT * FROM chatbot_entitlements ORDER BY responses"),
    query(
      "SELECT b.id,b.organization_id,b.name,b.slug,b.enabled,b.suspended,(SELECT display_name FROM business_profiles WHERE organization_id=b.organization_id) AS business,(SELECT jsonb_agg(jsonb_build_object('hostname',hostname,'verifiedAt',verified_at)) FROM chatbot_domains WHERE bot_id=b.id) AS domains FROM chatbots b WHERE b.deleted_at IS NULL ORDER BY b.created_at DESC LIMIT 500",
    ),
    query(
      "SELECT period,sum(completed)::bigint AS responses,sum(cost_micro_usd)::bigint AS estimated_micro_usd FROM chatbot_usage GROUP BY period ORDER BY period DESC LIMIT 12",
    ),
    query(
      "SELECT id,bot_id,model,error_code,created_at,reserved_micro_usd FROM chatbot_turns WHERE error_code IS NOT NULL ORDER BY created_at DESC LIMIT 50",
    ),
  ]);
  const unknown = (
    await query(
      "SELECT count(*)::int AS count,coalesce(sum(reserved_micro_usd),0)::bigint AS reserved FROM chatbot_turns WHERE state='uncertain' OR state='completed' AND actual_micro_usd IS NULL",
    )
  )[0];
  const alerts = await query(
    "SELECT b.id,b.organization_id,b.name,count(t.id)::int AS requests,count(t.id) FILTER(WHERE t.state='uncertain')::int AS uncertain,coalesce(sum(t.reserved_micro_usd) FILTER(WHERE t.ai_reserved),0)::bigint AS reserved FROM chatbots b JOIN chatbot_turns t ON t.bot_id=b.id WHERE t.created_at>now()-interval '24 hours' GROUP BY b.id HAVING count(t.id)>1000 OR count(t.id) FILTER(WHERE t.state='uncertain')>=5 ORDER BY requests DESC LIMIT 50",
  );
  return {
    alerts,
    settings: settings[0],
    entitlements,
    bots,
    usage,
    errors,
    unknown,
    plans: WEBSITE_PLANS,
    keyConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
  };
}
export async function chatbotAdminChange(
  operation: string,
  input: Record<string, unknown>,
) {
  try {
    const admin = await requireAdminCapability("manage_chatbots");
    const number = (value: unknown, max: number) => {
      const n = Number(value);
      if (!Number.isSafeInteger(n) || n < 0 || n > max)
        throw Error("Choose valid limits.");
      return n;
    };
    if (operation === "settings") {
      const model = text(input.model, 100),
        inputRate =
          input.input_usd_per_million === ""
            ? null
            : Number(input.input_usd_per_million),
        outputRate =
          input.output_usd_per_million === ""
            ? null
            : Number(input.output_usd_per_million);
      if (
        [inputRate, outputRate].some(
          (rate) =>
            rate !== null &&
            (!Number.isFinite(rate) || rate < 0 || rate > 10000),
        )
      )
        throw Error("Enter verified token rates.");
      if (
        input.ai_enabled === true &&
        (!model ||
          input.model_verified !== true ||
          inputRate === null ||
          outputRate === null ||
          !process.env.DEEPSEEK_API_KEY)
      )
        throw Error(
          "Configure a provider key and verify the model and token rates first.",
        );
      const maxTokens = number(input.max_output_tokens, 2048);
      if (maxTokens < 64) throw Error("Output tokens must be at least 64.");
      await query(
        "UPDATE chatbot_settings SET product_enabled=$1,ai_enabled=$2,model=$3,model_verified=$4,input_usd_per_million=$5,output_usd_per_million=$6,daily_cap_micro_usd=$7,max_output_tokens=$8,updated_at=now() WHERE id",
        [
          input.product_enabled === true,
          input.ai_enabled === true,
          model,
          input.model_verified === true,
          inputRate,
          outputRate,
          number(input.daily_cap_micro_usd, 100000000000),
          maxTokens,
        ],
      );
    } else if (operation === "entitlement") {
      if (!WEBSITE_PLANS.some((plan) => plan.id === input.plan_id))
        throw Error("Unknown plan.");
      if (
        !["basic", "standard", "advanced"].includes(String(input.analytics)) ||
        !["basic", "standard", "advanced"].includes(String(input.branding))
      )
        throw Error("Choose feature levels.");
      const retention = number(input.retention_days, 365);
      if (retention < 1) throw Error("Retention must be at least one day.");
      await query(
        "UPDATE chatbot_entitlements SET enabled=$2,bots=$3,responses=$4,knowledge=$5,retention_days=$6,appointments=$7,team_inbox=$8,remove_branding=$9,advanced_leads=$10,analytics=$11,branding=$12,monthly_cap_micro_usd=$13 WHERE plan_id=$1",
        [
          input.plan_id,
          input.enabled === true,
          number(input.bots, 100),
          number(input.responses, 100000),
          number(input.knowledge, 5000),
          retention,
          input.appointments === true,
          input.team_inbox === true,
          input.remove_branding === true,
          input.advanced_leads === true,
          input.analytics,
          input.branding,
          number(input.monthly_cap_micro_usd, 100000000000),
        ],
      );
    } else if (operation === "suspend")
      await query("UPDATE chatbots SET suspended=$2 WHERE id=$1", [
        uuid(input.id),
        input.suspended === true,
      ]);
    else if (operation === "orgCap")
      await query(
        "INSERT INTO chatbot_org_caps(organization_id,monthly_cap_micro_usd) VALUES($1,$2) ON CONFLICT(organization_id) DO UPDATE SET monthly_cap_micro_usd=excluded.monthly_cap_micro_usd",
        [uuid(input.organization), number(input.cap, 100000000000)],
      );
    else throw Error("Unsupported action.");
    await audit(null, admin.id, "ADMIN_" + operation.toUpperCase(), {
      id: input.id,
      plan: input.plan_id,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error &&
        /^(Choose|Enter|Configure|Unknown|Retention|Output)/.test(error.message)
          ? error.message
          : "This action requires authorized chatbot administration access.",
    };
  }
}
export async function chatbotSupportReview(botId: string, reason: string) {
  const admin = await requireAdminCapability("manage_chatbots");
  const purpose = text(reason, 500, true);
  if (purpose.length < 15) throw Error("Describe the authorized support need.");
  const bot = (
    await query("SELECT organization_id FROM chatbots WHERE id=$1", [
      uuid(botId),
    ])
  )[0];
  if (!bot) throw Error("Chatbot not found.");
  await audit(
    String(bot.organization_id),
    admin.id,
    "SUPPORT_CONVERSATION_ACCESS",
    { bot: botId, reason: purpose },
  );
  return query(
    "SELECT s.id,m.role,m.content,m.created_at FROM chatbot_sessions s JOIN chatbot_messages m ON m.session_id=s.id WHERE s.bot_id=$1 AND s.organization_id=$2 AND s.delete_at>now() AND s.created_at>now()-make_interval(days=>(SELECT retention_days FROM chatbot_limits(s.organization_id))) ORDER BY m.id DESC LIMIT 100",
    [botId, bot.organization_id],
  );
}
