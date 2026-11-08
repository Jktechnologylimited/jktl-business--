"use server";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import { revalidatePath } from "next/cache";
import { captureRecurringSnapshot } from "@/lib/growth/revenue-service";
import { verifyTransaction } from "@/lib/paystack";
import { getCycleDef, addBillingCycle, type BillingCycle } from "@/lib/billing";
export async function addAcquisitionCostAction(form: FormData) {
  const actor = await requireAdminCapability("manage_team");
  const spent = String(form.get("spent_on") || ""),
    amountInput = String(form.get("amount_ngn") || ""),
    amount = Math.round(Number(amountInput) * 100),
    evidence = String(form.get("evidence") || "").trim(),
    source = String(form.get("affiliate_id") || "");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(spent) ||
    !Number.isFinite(Date.parse(spent)) ||
    new Date(spent).toISOString().slice(0, 10) !== spent ||
    spent >
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()) ||
    !/^\d{1,8}(?:\.\d{1,2})?$/.test(amountInput) ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > 2000000000 ||
    evidence.length < 5 ||
    evidence.length > 500 ||
    (source && !/^[a-f0-9-]{36}$/i.test(source))
  )
    throw Error(
      "Enter a valid past spend date, amount in NGN, source and evidence reference.",
    );
  await query(
    "INSERT INTO growth_acquisition_costs(affiliate_id,spent_on,amount_kobo,evidence,created_by) VALUES($1,$2,$3,$4,$5)",
    [source || null, spent, amount, evidence, actor.id],
  );
  revalidatePath("/admin/insights");
}
export async function voidAcquisitionCostAction(form: FormData) {
  const actor = await requireAdminCapability("manage_team");
  const id = String(form.get("id") || "");
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw Error("Invalid cost record.");
  await query(
    "UPDATE growth_acquisition_costs SET voided_at=now(),voided_by=$2 WHERE id=$1 AND voided_at IS NULL",
    [id, actor.id],
  );
  revalidatePath("/admin/insights");
}
export async function captureRevenueSnapshotAction() {
  await requireAdminCapability("manage_team");
  await captureRecurringSnapshot();
  revalidatePath("/admin/insights");
}
export async function reconcileLegacyRevenueAction(form: FormData) {
  const actor = await requireAdminCapability("manage_team");
  const reference = String(form.get("reference") || "");
  if (!/^[a-z0-9_-]{8,160}$/i.test(reference))
    throw Error("Enter a valid provider payment reference.");
  const d = await verifyTransaction(reference),
    m = d.metadata as Record<string, unknown> | undefined;
  const org = String(m?.organizationId || ""),
    cycle = getCycleDef(String(m?.billingCycle || "") as BillingCycle);
  if (
    d.status !== "success" ||
    d.domain !== "live" ||
    d.reference !== reference ||
    d.currency !== "NGN" ||
    !Number.isSafeInteger(d.amount) ||
    !d.id ||
    !cycle ||
    !org
  )
    throw Error("Verified legacy payment identity is incomplete.");
  const row = (
    await query(
      "SELECT * FROM infrastructure_accounts WHERE organization_id=$1",
      [org],
    )
  )[0];
  if (
    !row ||
    Number(row.price_kobo_per_cycle) !== d.amount ||
    row.billing_cycle !== m?.billingCycle ||
    String(m?.type || "") === "website_plan"
  )
    throw Error(
      "This payment does not match the current legacy hosting contract.",
    );
  const paid = new Date(d.paid_at || "");
  if (!Number.isFinite(paid.getTime()))
    throw Error("Missing verified payment date.");
  // Read-only provider verification; no charge, refund or entitlement mutation.
  await query(
    "INSERT INTO growth_legacy_payments(reference,organization_id,provider_transaction,amount_kobo,months,paid_at,period_end,verified_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
    [
      reference,
      org,
      String(d.id),
      d.amount,
      cycle.months,
      paid.toISOString(),
      addBillingCycle(paid, cycle.id).toISOString(),
      actor.id,
    ],
  );
  revalidatePath("/admin/insights");
}
export async function recordOperationalCheckAction(form: FormData) {
  const actor = await requireAdminCapability("manage_team");
  const kind = String(form.get("kind") || ""),
    evidence = String(form.get("evidence") || "").trim();
  if (
    !["BACKUP_RESTORE", "MONITORING", "WEBHOOK", "SCHEDULER"].includes(kind) ||
    evidence.length < 10 ||
    evidence.length > 1000
  )
    throw Error(
      "Enter a supported check and a concrete verification reference. Do not paste secrets.",
    );
  await query(
    "INSERT INTO growth_operational_checks(kind,evidence,verified_by) VALUES($1,$2,$3) ON CONFLICT(kind) DO UPDATE SET evidence=excluded.evidence,verified_by=excluded.verified_by,verified_at=now()",
    [kind, evidence, actor.id],
  );
  revalidatePath("/admin/insights");
}
