"use server";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import { careInput } from "@/lib/customer-care/model";
import { redact } from "@/lib/support/model";
import { revalidatePath } from "next/cache";
export async function saveCustomerCareAction(form: FormData) {
  const a = await requireAdminCapability("manage_support"),
    input = careInput(form),
    org = String(form.get("organization") || ""),
    assigned = String(form.get("assigned") || "");
  if (
    assigned &&
    !(
      await query(
        "SELECT 1 FROM admin_users WHERE id=$1 AND role IN('owner','support') AND disabled_at IS NULL AND staff_revoked_at IS NULL",
        [assigned],
      )
    ).length
  )
    throw Error("Choose an active support teammate or team owner.");
  const rows = await query(
    `WITH changed AS(UPDATE customer_care SET status=$3,assigned_to=$4,follow_up_on=$5,checked_steps=$6::text[],notes=$7,revision=revision+1,updated_at=now() WHERE organization_id=$1 AND revision=$2 RETURNING *) INSERT INTO customer_care_audit(organization_id,actor_id,event,detail) SELECT organization_id,$8,'CARE_PROGRESS_UPDATED',jsonb_build_object('status',status,'assignedTo',assigned_to,'followUpOn',follow_up_on,'steps',checked_steps,'revision',revision) FROM changed RETURNING id`,
    [
      org,
      input.revision,
      input.status,
      assigned || null,
      input.follow,
      input.steps,
      redact(input.notes),
      a.id,
    ],
  );
  if (!rows.length)
    throw Error(
      "This care plan changed in another session. Refresh it before saving.",
    );
  revalidatePath("/admin/support/care");
  revalidatePath("/admin/support");
}
