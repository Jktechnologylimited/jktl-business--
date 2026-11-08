"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { can } from "@/lib/admin-permissions";
import { requireAdminSession } from "@/lib/admin-session";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import { redact } from "@/lib/support/model";
import { lifecycleSettings } from "@/lib/lifecycle/model";
import {
  dispatchLifecycle,
  reconcileLifecycle,
  reconcileJourneySignals,
  reconcileLifecycleMail,
} from "@/lib/lifecycle/service";
const refresh = () => {
  revalidatePath("/admin/emails/automation");
  revalidatePath("/admin/support/follow-ups");
};
async function audit(
  actor: string,
  event: string,
  org: string | null,
  detail: Record<string, unknown> = {},
) {
  await query(
    "INSERT INTO lifecycle_audit(actor_id,event,organization_id,detail) VALUES($1,$2,$3,$4::jsonb)",
    [actor, event, org, JSON.stringify(detail)],
  );
}
export async function configureLifecycleAction(form: FormData) {
  const a = await requireAdminCapability("manage_communications"),
    s = lifecycleSettings(form);
  await query(
    "UPDATE lifecycle_settings SET enabled=$1,first_days=$2,second_days=$3,human_days=$4,gap_days=$5,updated_at=now() WHERE id=true",
    [s.enabled, s.first_days, s.second_days, s.human_days, s.gap_days],
  );
  await query(
    "UPDATE renewal_settings SET enabled=$1,updated_at=now() WHERE id=true",
    [form.get("renewals") === "on"],
  );
  await audit(a.id, "AUTOMATION_SETTINGS_CHANGED", null, {
    ...s,
    renewals: form.get("renewals") === "on",
  });
  refresh();
}
export async function scanLifecycleAction() {
  const a = await requireAdminCapability("manage_communications");
  await reconcileLifecycleMail();
  await reconcileLifecycle();
  await reconcileJourneySignals();
  await audit(a.id, "LIFECYCLE_SCAN", null);
  refresh();
}
export async function dispatchLifecycleAction() {
  const a = await requireAdminCapability("manage_communications");
  await audit(a.id, "LIFECYCLE_DISPATCH_REQUESTED", null);
  after(async () => {
    await dispatchLifecycle(10, 15000);
  });
  refresh();
}
export async function pauseLifecycleAction(form: FormData) {
  const a = await requireAdminSession();
  if (
    !can(a.role, "manage_support", a.permissions) &&
    !can(a.role, "manage_communications", a.permissions)
  )
    throw Error("Not authorized to pause follow-ups.");
  const org = String(form.get("organization") || ""),
    raw = String(form.get("until") || "");
  if (
    raw &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(raw) ||
      !Number.isFinite(new Date(raw + "T23:59:59+01:00").getTime()) ||
      new Date(raw + "T00:00:00Z").toISOString().slice(0, 10) !== raw)
  )
    throw Error("Choose a valid pause date.");
  if (
    !(
      await query(
        "UPDATE lifecycle_accounts SET paused_until=$2::timestamptz,updated_at=now() WHERE organization_id=$1 RETURNING organization_id",
        [org, raw ? raw + "T23:59:59+01:00" : null],
      )
    ).length
  )
    throw Error("Account not found.");
  await audit(a.id, "ACCOUNT_PAUSE_CHANGED", org, { until: raw || null });
  refresh();
}
export async function saveLifecycleHandoffAction(form: FormData) {
  const a = await requireAdminCapability("manage_support"),
    id = String(form.get("id") || ""),
    status = String(form.get("status") || ""),
    assigned = String(form.get("assigned") || ""),
    notes = String(form.get("notes") || "").trim(),
    revision = Number(form.get("revision"));
  if (
    !["OPEN", "IN_PROGRESS", "DONE"].includes(status) ||
    notes.length > 2000 ||
    !Number.isInteger(revision) ||
    revision < 0
  )
    throw Error("Check the follow-up details.");
  if (
    status === "DONE" &&
    (
      await query(
        "SELECT 1 FROM lifecycle_handoffs h JOIN lifecycle_events e ON h.cycle_key='mail:'||e.id::text WHERE h.id=$1 AND(e.state='UNKNOWN' OR(e.state='FAILED' AND e.attempts>=3))",
        [id],
      )
    ).length
  )
    throw Error(
      "The email outcome needs review in Emails before this provider task can be closed.",
    );
  if (
    assigned &&
    !(
      await query(
        "SELECT 1 FROM admin_users WHERE id=$1 AND role IN('owner','support') AND disabled_at IS NULL AND staff_revoked_at IS NULL",
        [assigned],
      )
    ).length
  )
    throw Error("Choose an active support teammate.");
  const rows = await query(
    "UPDATE lifecycle_handoffs SET status=$2,assigned_to=$3,notes=$4,revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$5 RETURNING organization_id",
    [id, status, assigned || null, redact(notes), revision],
  );
  if (!rows.length)
    throw Error("This follow-up changed. Refresh before saving.");
  await audit(a.id, "HUMAN_FOLLOWUP_UPDATED", String(rows[0].organization_id), {
    id,
    status,
    assigned: assigned || null,
  });
  refresh();
}
export async function reviewLifecycleMailAction(form: FormData) {
  const a = await requireAdminCapability("manage_communications"),
    id = String(form.get("id") || ""),
    decision = String(form.get("decision") || ""),
    reason = String(form.get("reason") || "").trim();
  if (
    !["ACCEPTED", "CANCELLED", "RETRY"].includes(decision) ||
    reason.length < 10 ||
    reason.length > 1000
  )
    throw Error("Choose an outcome and give a 10–1000 character review note.");
  if (decision === "RETRY" && form.get("notAccepted") !== "on")
    throw Error(
      "Confirm with the provider that this email was not accepted before retrying.",
    );
  const result = await query(
    `UPDATE lifecycle_events SET state=$2,attempts=CASE WHEN $2='QUEUED' THEN 0 ELSE attempts END,next_attempt_at=now(),lease_until=NULL,last_error=NULL,updated_at=now() WHERE id=$1 AND state IN('UNKNOWN','FAILED') RETURNING organization_id`,
    [id, decision === "RETRY" ? "QUEUED" : decision],
  );
  if (!result.length)
    throw Error("Only failed or unconfirmed messages can be reviewed.");
  await query(
    "UPDATE lifecycle_handoffs SET status='DONE',revision=revision+1,updated_at=now() WHERE cycle_key=$1",
    ["mail:" + id],
  );
  await audit(
    a.id,
    "LIFECYCLE_MAIL_REVIEWED",
    String(result[0].organization_id),
    { id, decision, reason: redact(reason) },
  );
  refresh();
}
