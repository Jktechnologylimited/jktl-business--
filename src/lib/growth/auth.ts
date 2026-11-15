import "server-only";
import { verifyLogin } from "@/lib/db/auth";
import { linkedBusinessStaff } from "@/lib/db/admin-auth";
import { startSession } from "@/lib/session";
import { query } from "@/lib/custom/service";
import { adminLandingPath } from "@/lib/admin-permissions";
export async function signInGrowthStaff(email: string, password: string) {
  const login = await verifyLogin(email, password);
  const staff = login ? await linkedBusinessStaff(login.user.id) : null;
  if (!login || !staff) return null;
  await startSession(login.user.id, login.organizationId);
  await query("UPDATE admin_users SET last_login_at=now() WHERE id=$1", [
    staff.id,
  ]);
  return adminLandingPath(staff.role, staff.permissions);
}
