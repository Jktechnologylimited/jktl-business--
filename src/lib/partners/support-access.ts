import "server-only";
import { requireAdminCapability } from "@/lib/admin-session";
/** Broader customer support is never granted to Growth or Affiliate managers. */
export async function programmeSupportAgent() {
  try {
    return await requireAdminCapability("manage_support");
  } catch {}
  try {
    return await requireAdminCapability("manage_affiliates");
  } catch {}
  return requireAdminCapability("growth_community");
}
