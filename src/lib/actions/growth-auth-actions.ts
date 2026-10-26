"use server";
import { getAdminSession } from "@/lib/admin-session";
export async function growthDestinationAction() {
  const a = await getAdminSession();
  return a?.role === "growth_gaming_lead" ? "/admin/growth" : null;
}
