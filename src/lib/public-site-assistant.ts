import { publicOrigin } from "@/lib/chatbot/model";
import { query } from "@/lib/chatbot/store";
import { getConfig } from "@/lib/db/receptionist";
import { getPack, packForBusinessType } from "@/lib/ai/industry-packs";
import { buildGreeting } from "@/lib/ai/prompt";
import type { BusinessProfile } from "@/lib/types";
/** Keep the existing assistant configuration consistent on every public page. */
export async function publicSiteAssistant(
  profile: Pick<
    BusinessProfile,
    "organizationId" | "businessType" | "displayName"
  >,
) {
  try {
    const bot = (
      await query(
        "SELECT b.id,b.name FROM chatbots b CROSS JOIN chatbot_settings c WHERE b.organization_id=$1 AND b.install_on_builder AND b.enabled AND NOT b.suspended AND b.deleted_at IS NULL AND chatbot_eligible(b.id) AND c.id AND c.product_enabled AND (SELECT enabled FROM chatbot_limits(b.organization_id)) LIMIT 1",
        [profile.organizationId],
      )
    )[0];
    if (bot)
      return {
        enabled: true,
        packLabel: "AI Chatbot",
        greeting: "Chat with " + bot.name,
        chatbotId: String(bot.id),
        chatbotOrigin: publicOrigin(),
      };
  } catch (error) {
    if (!["42P01", "42883"].includes(String((error as { code?: string }).code)))
      throw error;
  }
  const config = await getConfig(profile.organizationId);
  const pack = getPack(
    config?.packId ?? packForBusinessType(profile.businessType).id,
  );
  return config?.enabled
    ? {
        enabled: true,
        packLabel: pack.label,
        greeting: buildGreeting({
          customGreeting: config.greeting,
          pack,
          businessName: profile.displayName,
          patientName: "",
        }),
      }
    : { enabled: false, packLabel: pack.label, greeting: "" };
}
