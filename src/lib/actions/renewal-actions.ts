"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import { mailAddress } from "@/lib/mail/addresses";
import {
  dispatchRenewals,
  queueRenewal,
  reconcileRenewals,
} from "@/lib/renewals/service";
async function actor() {
  return requireAdminCapability("manage_communications");
}
async function audit(
  id: string,
  event: string,
  key: string | null,
  detail: Record<string, unknown> = {},
) {
  await query(
    "INSERT INTO renewal_audit(actor_id,event,item_key,detail) VALUES($1,$2,$3,$4::jsonb)",
    [id, event, key, JSON.stringify(detail)],
  );
}
function refresh() {
  revalidatePath("/admin/emails/renewals");
  revalidatePath("/business/renewals");
}
export async function configureRenewalsAction(form: FormData) {
  const a = await actor();
  await query(
    "UPDATE renewal_settings SET enabled=$1,updated_at=now() WHERE id=true",
    [form.get("enabled") === "on"],
  );
  await audit(a.id, "RENEWAL_AUTOMATION_CHANGED", null, {
    enabled: form.get("enabled") === "on",
  });
  refresh();
}
export async function sendRenewalAction(form: FormData) {
  const a = await actor(),
    key = String(form.get("item") || "");
  const id = await queueRenewal(key, true);
  if (!id)
    throw Error(
      "A reminder is already queued or was sent recently for this renewal.",
    );
  await audit(a.id, "MANUAL_RENEWAL_QUEUED", key, { reminder: id });
  after(async () => {
    await dispatchRenewals(5);
  });
  refresh();
}
export async function processRenewalsAction() {
  const a = await actor();
  await reconcileRenewals();
  await audit(a.id, "RENEWAL_QUEUE_PROCESSED", null);
  after(async () => {
    await dispatchRenewals(10);
  });
  refresh();
}
export async function retryRenewalAction(form: FormData) {
  const a = await actor(),
    id = String(form.get("id") || ""),
    reason = String(form.get("reason") || "").trim();
  if (reason.length < 10 || reason.length > 1000)
    throw Error("Provide a review note of 10–1000 characters.");
  const rows = await query(
    `UPDATE renewal_reminders r SET state='QUEUED',attempts=0,next_attempt_at=now(),lease_until=NULL,last_error=NULL,updated_at=now() WHERE id=$1 AND(state='FAILED' OR(state='UNKNOWN' AND $2::boolean)) AND NOT EXISTS(SELECT 1 FROM renewal_reminders other WHERE other.id<>r.id AND other.item_key=r.item_key AND other.due_on=r.due_on AND other.recipient=r.recipient AND(other.state IN('QUEUED','SUBMITTING','UNKNOWN') OR(other.state='ACCEPTED' AND other.updated_at>now()-interval '24 hours'))) RETURNING item_key`,
    [id, form.get("confirmedNotAccepted") === "on"],
  );
  if (!rows.length)
    throw Error(
      "Only a failed reminder or a provider-confirmed unsubmitted email can be retried.",
    );
  await audit(a.id, "RENEWAL_RETRY_APPROVED", String(rows[0].item_key), {
    id,
    reason,
  });
  after(async () => {
    await dispatchRenewals(5);
  });
  refresh();
}
export async function saveTrackedRenewalAction(form: FormData) {
  const a = await actor(),
    org = String(form.get("organization") || ""),
    name = String(form.get("name") || "").trim(),
    kind = String(form.get("kind") || ""),
    due = String(form.get("due") || ""),
    email = String(form.get("recipient") || "").trim(),
    raw = String(form.get("amount") || ""),
    amount = raw ? Math.round(Number(raw) * 100) : null,
    id = String(form.get("id") || "");
  if (
    due &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(due) ||
      !Number.isFinite(new Date(due + "T00:00:00Z").getTime()) ||
      new Date(due + "T00:00:00Z").toISOString().slice(0, 10) !== due)
  )
    throw Error("Provide a valid renewal date.");
  if (
    !/^[a-f0-9-]{36}$/i.test(org) ||
    name.length < 2 ||
    name.length > 180 ||
    !["DOMAIN", "HOSTING", "BUSINESS_EMAIL", "OTHER"].includes(kind) ||
    (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) ||
    (email && !mailAddress(email)) ||
    (amount !== null &&
      (!Number.isSafeInteger(amount) || amount < 0 || amount > 2000000000))
  )
    throw Error("Check the account, service, date, amount and billing email.");
  if (!(await query("SELECT 1 FROM organizations WHERE id=$1", [org])).length)
    throw Error("Current business account required.");
  const values = [
    org,
    name,
    kind,
    due || null,
    amount,
    email ? mailAddress(email) : null,
    form.get("cancel") === "on" ? "CANCELLED" : "ACTIVE",
  ];
  const rows = id
    ? await query(
        "UPDATE renewal_tracked_services SET name=$2,kind=$3,due_on=$4,amount_kobo=$5,recipient=$6,status=$7,updated_at=now() WHERE organization_id=$1 AND id=$8 RETURNING id",
        [...values, id],
      )
    : await query(
        "INSERT INTO renewal_tracked_services(organization_id,name,kind,due_on,amount_kobo,recipient,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
        [...values, a.id],
      );
  if (!rows.length) throw Error("Current tracked subscription required.");
  await audit(a.id, "TRACKED_RENEWAL_SAVED", "tracked:" + rows[0].id, {
    due: due || null,
    status: values[6],
  });
  refresh();
}

export async function runRenewalCheckAction() {
  const a = await actor();
  const { centralRenewalsEnabled, runCentralRenewals } =
    await import("@/lib/renewals/service");
  if (!(await centralRenewalsEnabled()))
    throw Error(
      "Enable automatic reminders first, or preview and send a single reminder.",
    );
  await audit(a.id, "MANUAL_RENEWAL_CHECK", null);
  after(async () => {
    await runCentralRenewals();
  });
  refresh();
}
export async function confirmRenewalAcceptanceAction(form: FormData) {
  const a = await actor(),
    id = String(form.get("id") || ""),
    reason = String(form.get("reason") || "").trim(),
    provider = String(form.get("provider") || "").trim();
  if (
    form.get("confirmedAccepted") !== "on" ||
    reason.length < 10 ||
    reason.length > 1000 ||
    !/^[-a-z0-9_]{3,120}$/i.test(provider)
  )
    throw Error("Provide the verified provider message ID and a review note.");
  const rows = await query(
    "UPDATE renewal_reminders SET state='ACCEPTED',provider_id=$2,lease_until=NULL,last_error=NULL,updated_at=now() WHERE id=$1 AND state='UNKNOWN' RETURNING item_key",
    [id, provider],
  );
  if (!rows.length)
    throw Error("Only an unconfirmed submission can be resolved this way.");
  await audit(a.id, "RENEWAL_ACCEPTANCE_CONFIRMED", String(rows[0].item_key), {
    id,
    provider,
    reason,
  });
  refresh();
}
