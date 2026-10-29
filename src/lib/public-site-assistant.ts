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
