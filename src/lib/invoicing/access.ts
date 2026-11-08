import "server-only";
import { requireSession } from "@/lib/session";
import { query } from "@/lib/custom/service";
export async function invoiceAccess(ownerOnly = false) {
  const session = await requireSession();
  const rows = await query(
    "SELECT role FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND active=true",
    [session.organizationId, session.userId],
  );
  if (
    !rows.some((r) =>
      ownerOnly
        ? r.role === "owner"
        : ["owner", "manager"].includes(String(r.role)),
    )
  )
    throw Error(
      "Only an authorized business owner can change receiving bank details; owners and managers can manage invoices.",
    );
  return session;
}
