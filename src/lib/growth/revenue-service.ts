import "server-only";
import { getSql } from "@/lib/db/client";
import { query } from "@/lib/custom/service";
import {
  COMPANY_RECURRING_CTE,
  SOURCES,
  preparedSourceSql,
} from "@/lib/investor/queries";
export async function growthInstalled() {
  return Boolean(
    (await query("SELECT to_regclass('public.growth_signals') present"))[0]
      ?.present,
  );
}
export async function captureRecurringSnapshot() {
  if (!(await growthInstalled())) return { installed: false };
  const sql = getSql(),
    tables = SOURCES.companyRecurring.tables;
  const present = await sql.query(
    "SELECT name,to_regclass('public.'||name) present FROM unnest($1::text[]) name",
    [[...tables]],
  );
  if (present.some((r) => !r.present))
    throw Error("Recurring source coverage incomplete; snapshot not saved.");
  const now = new Date().toISOString();
  const rows = await sql.query(
    preparedSourceSql(
      `${COMPANY_RECURRING_CTE} INSERT INTO growth_recurring_snapshots(day,items,coverage) SELECT ($4::timestamptz AT TIME ZONE 'Africa/Lagos')::date,COALESCE(jsonb_agg(jsonb_build_object('service_key',service_key,'organization_id',organization_id,'product',product,'mrr',mrr)),'[]'),jsonb_build_object('definition','Verified paid recurring services; conservative overlap exclusions; snapshot at capture time.') FROM recurring_items ON CONFLICT(day) DO NOTHING RETURNING day`,
    ),
    [now, now, now, now],
  );
  return { installed: true, saved: rows.length };
}
export async function recordPaidFeature(organizationId: string) {
  if (!(await growthInstalled())) return;
  await query(
    "INSERT INTO growth_signals(organization_id,kind,source_key) VALUES($1,'PAID_FEATURE',$1::uuid::text||':'||to_char(now() AT TIME ZONE 'Africa/Lagos','YYYY-MM')) ON CONFLICT DO NOTHING",
    [organizationId],
  );
}
export async function growthMaintenance() {
  if (!(await growthInstalled())) return { installed: false };
  await query("DELETE FROM growth_visits WHERE expires_at<now()");
  return captureRecurringSnapshot();
}
export async function recordLegacyPaidEvidence(
  organizationId: string,
  data: Record<string, unknown>,
) {
  if (
    data.status !== "success" ||
    data.domain !== "live" ||
    data.currency !== "NGN" ||
    !Number.isSafeInteger(data.amount) ||
    !data.id ||
    typeof data.reference !== "string" ||
    !(await growthInstalled())
  )
    return;
  const infra = (
    await query(
      "SELECT billing_cycle,price_kobo_per_cycle FROM infrastructure_accounts WHERE organization_id=$1",
      [organizationId],
    )
  )[0];
  if (!infra || Number(infra.price_kobo_per_cycle) !== data.amount) return;
  const { getCycleDef, addBillingCycle } = await import("@/lib/billing");
  const cycle = getCycleDef(
      infra.billing_cycle as import("@/lib/billing").BillingCycle,
    ),
    paid = new Date(String(data.paid_at || ""));
  if (!cycle || !Number.isFinite(paid.getTime())) return;
  await query(
    "INSERT INTO growth_legacy_payments(reference,organization_id,provider_transaction,amount_kobo,months,paid_at,period_end,verification_source) VALUES($1,$2,$3,$4,$5,$6,$7,'PROVIDER') ON CONFLICT DO NOTHING",
    [
      data.reference,
      organizationId,
      String(data.id),
      data.amount,
      cycle.months,
      paid.toISOString(),
      addBillingCycle(paid, cycle.id).toISOString(),
    ],
  );
}
