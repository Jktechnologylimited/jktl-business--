import "server-only";
import { query } from "@/lib/custom/service";
import { can, type AdminCapability } from "@/lib/admin-permissions";
import { requireAdminCapability } from "@/lib/admin-session";
export { query };
export async function growth(capability: AdminCapability = "growth_workspace") {
  return requireAdminCapability(capability);
}
export const permitted = can;
export async function audit(
  actor: string,
  event: string,
  target: string,
  detail: Record<string, unknown> = {},
) {
  await query(
    "INSERT INTO distribution_audit(actor_id,event,detail) VALUES($1,$2,$3::jsonb)",
    [actor, event, JSON.stringify({ target, ...detail })],
  );
}
export function field(f: FormData, key: string, max = 2000) {
  const value = String(f.get(key) || "").trim();
  if (!value || value.length > max) throw Error("Check " + key);
  return value;
}
export function uuid(v: unknown) {
  const s = String(v || "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  )
    throw Error("Invalid record");
  return s;
}
