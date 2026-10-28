"use server";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/domains/service";
import { routeManual } from "@/lib/domains/fulfillment";
import {
  confirmRegistrarNotApplied,
  recordRegistrarConfirmation,
  finalizeRegistrarConfirmation,
} from "@/lib/domains/registrar-operations";
import { rateLimit } from "@/lib/domains/store";
const uuid = (v: unknown) => {
  if (
    typeof v !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
  )
    throw Error("Invalid domain record.");
  return v;
};
const failed = () => ({
  ok: false as const,
  error:
    "Could not update fulfillment. Check permissions, current order state and registrar evidence, then reload.",
});
export async function saveDomainFulfillmentSettingsAction(raw: {
  mode: string;
  extension?: string;
  manualOnly?: boolean;
}) {
  try {
    const actor = await requireAdminCapability("manage_domains");
    if (!raw || !["MANUAL", "AUTOMATIC"].includes(raw.mode)) throw Error();
    if (
      raw.extension !== undefined &&
      (!/^\.[a-z]{2,}(\.[a-z]{2,})?$/.test(raw.extension) ||
        typeof raw.manualOnly !== "boolean")
    )
      throw Error();
    await query(
      `WITH setting AS(UPDATE domain_purchase_controls SET default_fulfillment_mode=$1,updated_by=$2,updated_at=now() WHERE id=true RETURNING id),
   extension AS(UPDATE domain_prices SET manual_only=$4,revision=revision+1 WHERE extension=$3 RETURNING extension)
   INSERT INTO domain_audit(actor_id,actor_type,event,detail) VALUES($2,'admin','FULFILLMENT_SETTINGS_UPDATED',jsonb_build_object('mode',$1::text,'extension',$3::text,'manualOnly',$4::boolean))`,
      [raw.mode, actor.id, raw.extension || null, raw.manualOnly ?? null],
    );
    // This selects preference only; it never enables live registrar POSTs or checkout.
    return { ok: true as const };
  } catch {
    return failed();
  }
}
export async function assignDomainOrderAction(raw: {
  id: string;
  assignee: string;
  revision: number;
}) {
  try {
    const actor = await requireAdminCapability("manage_domains");
    if (!Number.isInteger(raw.revision) || raw.revision < 1) throw Error();
    const rows = await query(
      `WITH changed AS(UPDATE domain_orders SET assigned_to=$2,fulfillment_revision=fulfillment_revision+1,updated_at=now()
    WHERE id=$1 AND fulfillment_revision=$3 AND status IN('PAID','PROCESSING')
    AND EXISTS(SELECT 1 FROM admin_users WHERE id=$2 AND disabled_at IS NULL AND role IN('owner','support')) RETURNING *)
    INSERT INTO domain_audit(organization_id,order_id,actor_id,actor_type,event,detail) SELECT organization_id,id,$4,'admin','MANUAL_ORDER_ASSIGNED',jsonb_build_object('assignee',$2::uuid) FROM changed RETURNING id`,
      [uuid(raw.id), uuid(raw.assignee), raw.revision, actor.id],
    );
    if (!rows.length) throw Error();
    return { ok: true as const };
  } catch {
    return failed();
  }
}
export async function routeDomainManualAction(id: string) {
  try {
    const actor = await requireAdminCapability("manage_domains");
    await routeManual(query, uuid(id), "ADMIN_SELECTED", actor.id);
    return { ok: true as const };
  } catch {
    return failed();
  }
}
/** Owner-operated reconciliation from actual registrar account evidence. A
 * registry absence or elapsed timeout cannot authorize this action. */
export async function reconcileDomainOperationAction(raw: {
  operationId: string;
  outcome: "NOT_APPLIED" | "CONFIRMED";
  reference: string;
  checkedRegistrarAccount: boolean;
  noPendingOperation: boolean;
  registeredAt?: string;
  expiresAt?: string;
  nameservers?: string;
}) {
  try {
    const actor = await requireAdminCapability("manage_domains");
    await rateLimit(query, actor.id, "registrar-reconcile", 10, 300);
    if (
      raw.checkedRegistrarAccount !== true ||
      typeof raw.reference !== "string" ||
      raw.reference.trim().length < 3 ||
      raw.reference.length > 200 ||
      /[\x00-\x1f\x7f]/.test(raw.reference)
    )
      throw Error();
    const op = (
      await query("SELECT * FROM domain_registrar_operations WHERE id=$1", [
        uuid(raw.operationId),
      ])
    )[0];
    if (
      !op ||
      !["SUBMITTED", "UNKNOWN", "CONFIRMED"].includes(String(op.state))
    )
      throw Error();
    await query(
      "INSERT INTO domain_audit(order_id,actor_id,actor_type,event,detail) VALUES($1,$2,'admin','REGISTRAR_ACCOUNT_REVIEWED',jsonb_build_object('operation',$3::uuid,'evidenceReference',$4::text,'outcome',$5::text))",
      [op.order_id, actor.id, op.id, raw.reference.trim(), raw.outcome],
    );
    if (raw.outcome === "NOT_APPLIED") {
      if (raw.noPendingOperation !== true) throw Error();
      await confirmRegistrarNotApplied(query, String(op.id), {
        domain: String(op.domain),
        checkedAt: new Date(),
        accountVerified: true,
        definitelyNotApplied: true,
        pending: false,
      });
      await routeManual(
        query,
        String(op.order_id),
        "PROVIDER_RECOVERABLE",
        actor.id,
      );
    } else if (raw.outcome === "CONFIRMED") {
      if (op.state !== "CONFIRMED")
        await recordRegistrarConfirmation(query, String(op.id), {
          domain: String(op.domain),
          transactionReference: raw.reference.trim(),
          registeredAt: raw.registeredAt || "",
          expiresAt: raw.expiresAt || "",
          nameservers: (raw.nameservers || "").split(/[\s,]+/).filter(Boolean),
          accountVerified: true,
        });
      else if (op.transaction_reference !== raw.reference.trim()) throw Error();
      await finalizeRegistrarConfirmation(query, String(op.id), actor.id);
    } else throw Error();
    return { ok: true as const };
  } catch {
    return failed();
  }
}
