"use server";

import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { getSession, startSession } from "@/lib/session";
import { verifyLogin } from "@/lib/db/auth";
import { query } from "@/lib/custom/service";
import { authRateLimit } from "@/lib/security/auth-rate-limit";
import {
  ensureTeamBusinessAccess,
  connectExistingTeamBusiness,
  TeamBusinessConflict,
} from "@/lib/team-business-access";

export async function openTeamBusinessAction() {
  const team = await requireAdminSession();
  await authRateLimit(team.id, "team-business-open", 20, 600);
  let login;
  try {
    login = await ensureTeamBusinessAccess(query, team.id);
  } catch (error) {
    if (error instanceof TeamBusinessConflict) redirect("/admin/business");
    throw error;
  }
  const current = await getSession();
  if (current?.userId !== login.user.id)
    await startSession(login.user.id, login.organizationId);
  redirect("/account/continue");
}

export async function connectTeamBusinessAction(f: FormData) {
  const team = await requireAdminSession();
  await authRateLimit(team.id, "team-business-connect", 8, 600);
  if (team.businessUserId)
    throw Error(
      "This Team account is already connected. Use Open JKTL Business.",
    );
  const login = await verifyLogin(team.email, String(f.get("password") || ""));
  if (!login)
    throw Error("Check the password for your existing Business account.");
  await connectExistingTeamBusiness(query, team.id, login.user.id);
  await startSession(login.user.id, login.organizationId);
  redirect("/account/continue");
}
