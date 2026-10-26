"use server";
import { requireSession } from "@/lib/session";
import { query } from "@/lib/custom/service";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
export async function saveMyMailPreferencesAction(f: FormData) {
  const s = await requireSession();
  const opted = f.get("marketing") === "on";
  const row = (
    await query("SELECT email FROM users WHERE id=$1", [s.userId])
  )[0];
  if (!row) throw Error("Sign in required");
  await query(
    `INSERT INTO email_preferences(email,marketing_opt_in,marketing_suppressed,consent_version) VALUES(lower($1),$2,NOT $2,'email-preferences-2026-10') ON CONFLICT(email) DO UPDATE SET marketing_opt_in=excluded.marketing_opt_in,marketing_suppressed=excluded.marketing_suppressed,consent_version=excluded.consent_version,updated_at=now()`,
    [row.email, opted],
  );
  revalidatePath("/business/email-preferences");
}
export async function unsubscribeMailAction(f: FormData) {
  const token = String(f.get("token") || "");
  if (!/^[0-9a-f-]{36}$/i.test(token)) throw Error("Invalid preference link");
  await query(
    "UPDATE email_preferences SET marketing_opt_in=false,marketing_suppressed=true,updated_at=now() WHERE preference_token=$1",
    [token],
  );
  redirect("/email-preferences?done=1");
}
