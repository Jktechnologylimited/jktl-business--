"use server";
import { requireAdminCapability } from "@/lib/admin-session";
import { query, audit } from "@/lib/custom/service";
import { id, text, token, digest } from "@/lib/custom/model";
import { invoiceInput, portalScopes } from "@/lib/custom/portal-model";
import { revalidatePath } from "next/cache";
const refresh = () => revalidatePath("/admin/custom-projects");
export async function customPortalOverviewAction() {
  await requireAdminCapability("manage_custom");
  const [summary, owners, keys, invoices, payments, tickets] =
    await Promise.all([
      query(
        `SELECT (SELECT count(*) FROM custom_projects) AS projects,(SELECT count(*) FROM custom_services WHERE status='ACTIVE') AS active_contracts,(SELECT count(*) FROM custom_services WHERE status='ACTIVE' AND next_due_on BETWEEN CURRENT_DATE AND CURRENT_DATE+30) AS upcoming_renewals,(SELECT COALESCE(sum(amount_kobo-paid_kobo),0) FROM custom_invoices WHERE status='OPEN') AS outstanding_kobo,(SELECT COALESCE(sum(amount_kobo-paid_kobo),0) FROM custom_invoices WHERE status='OPEN' AND due_on<CURRENT_DATE) AS overdue_kobo,(SELECT count(*) FROM support_cases WHERE custom_project_id IS NOT NULL AND status<>'RESOLVED') AS open_tickets`,
      ),
      query(
        "SELECT a.*,u.email FROM custom_project_owners a JOIN users u ON u.id=a.user_id ORDER BY project_id",
      ),
      query(
        "SELECT id,project_id,label,scopes,created_at,revoked_at FROM custom_project_keys ORDER BY created_at DESC",
      ),
      query(
        "SELECT i.*,p.name AS project_label,o.name AS organization FROM custom_invoices i JOIN custom_projects p ON p.id=i.project_id JOIN organizations o ON o.id=i.organization_id ORDER BY i.created_at DESC LIMIT 250",
      ),
      query(
        `SELECT p.reference,p.amount_kobo,p.refunded_kobo,p.state,p.verified_at,i.project_id FROM custom_invoice_payments p JOIN custom_invoices i ON i.id=p.invoice_id ORDER BY p.created_at DESC LIMIT 40`,
      ),
      query(
        `SELECT c.id,c.subject,c.status,c.custom_project_id,p.name FROM support_cases c JOIN custom_projects p ON p.id=c.custom_project_id ORDER BY c.updated_at DESC LIMIT 40`,
      ),
    ]);
  return { summary: summary[0], owners, keys, invoices, payments, tickets };
}
export async function configureProjectPortalAction(input: {
  projectId: string;
  enabled: boolean;
  returnPath?: string;
  localSubject?: string;
  email?: string;
  scopes?: string[];
  remove?: boolean;
}) {
  const a = await requireAdminCapability("manage_custom"),
    projectId = id(input.projectId);
  if (typeof input.enabled !== "boolean")
    throw Error("Select an integration state.");
  const project = (
    await query("SELECT * FROM custom_projects WHERE id=$1", [projectId])
  )[0];
  if (!project) throw Error("Project unavailable.");
  if (input.localSubject) {
    const subject = text(input.localSubject, 200);
    if (/[\r\n]/.test(subject)) throw Error("Invalid local identity.");
    if (input.remove) {
      await query(
        "UPDATE custom_project_owners SET active=false WHERE project_id=$1 AND local_subject=$2",
        [projectId, subject],
      );
    } else {
      const scopes = portalScopes(input.scopes);
      const member = (
        await query(
          `SELECT u.id FROM users u JOIN organization_members m ON m.user_id=u.id WHERE lower(u.email)=lower($1) AND m.organization_id=$2 AND m.active=true`,
          [text(input.email, 254), project.organization_id],
        )
      )[0];
      if (!member)
        throw Error("Select an active member of this client organization.");
      await query(
        `INSERT INTO custom_project_owners(project_id,organization_id,user_id,local_subject,scopes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(project_id,local_subject) DO UPDATE SET user_id=excluded.user_id,scopes=excluded.scopes,active=true`,
        [projectId, project.organization_id, member.id, subject, scopes],
      );
    }
  }
  if (
    input.returnPath !== undefined &&
    !/^\/[A-Za-z0-9/_-]{0,200}$/.test(input.returnPath)
  )
    throw Error("Enter a local dashboard return path.");
  await query(
    "UPDATE custom_projects SET portal_enabled=$2,portal_return_path=COALESCE($3,portal_return_path),revision=revision+1 WHERE id=$1",
    [projectId, input.enabled, input.returnPath ?? null],
  );
  await audit(
    String(project.organization_id),
    a.id,
    "PROJECT_PORTAL_CONFIGURED",
    {
      enabled: input.enabled,
      localSubject: input.localSubject || null,
      removed: !!input.remove,
    },
    projectId,
  );
  refresh();
}
export async function rotateProjectKeyAction(
  projectId: string,
  label: string,
  scopes: string[],
) {
  const a = await requireAdminCapability("manage_custom");
  id(projectId);
  const secret = "jktl_proj_" + crypto.randomUUID() + "." + token();
  const rows = await query(
    `WITH revoked AS(UPDATE custom_project_keys SET revoked_at=now() WHERE project_id=$1 AND revoked_at IS NULL RETURNING id),created AS(INSERT INTO custom_project_keys(project_id,organization_id,key_hash,label,scopes) SELECT id,organization_id,$2,$3,$4 FROM custom_projects WHERE id=$1 AND (SELECT count(*) FROM revoked)>=0 RETURNING *) SELECT organization_id FROM created`,
    [projectId, digest(secret), text(label, 100), portalScopes(scopes)],
  );
  if (!rows.length) throw Error("Project unavailable.");
  await audit(
    String(rows[0].organization_id),
    a.id,
    "PROJECT_KEY_ROTATED",
    {},
    projectId,
  );
  refresh();
  return { key: secret };
}
export async function revokeProjectKeyAction(keyId: string) {
  const a = await requireAdminCapability("manage_custom");
  const rows = await query(
    "UPDATE custom_project_keys SET revoked_at=now() WHERE id=$1 RETURNING organization_id,project_id",
    [id(keyId)],
  );
  if (rows[0])
    await audit(
      String(rows[0].organization_id),
      a.id,
      "PROJECT_KEY_REVOKED",
      { keyId },
      String(rows[0].project_id),
    );
  refresh();
}
export async function createProjectInvoiceAction(input: {
  projectId: string;
  items: unknown;
  instalments?: unknown;
  dueOn: string;
  issue: boolean;
}) {
  const a = await requireAdminCapability("manage_custom");
  if (typeof input.issue !== "boolean") throw Error("Select draft or issue.");
  const values = invoiceInput(input),
    invoiceId = crypto.randomUUID();
  const number =
    "JKTL-" +
    new Date().getUTCFullYear() +
    "-" +
    invoiceId.slice(0, 8).toUpperCase();
  const rows = await query(
    `WITH inserted AS(INSERT INTO custom_invoices(id,organization_id,project_id,due_on,description,amount_kobo,status,version,invoice_number,line_items,instalments,customer_name,project_name,issued_at) SELECT $1,p.organization_id,p.id,$3,$4,$5,$6,2,$7,$8::jsonb,$9::jsonb,o.name,p.name,CASE WHEN $6='OPEN' THEN now() ELSE NULL END FROM custom_projects p JOIN organizations o ON o.id=p.organization_id WHERE p.id=$2 RETURNING *),logged AS(INSERT INTO custom_audit(organization_id,project_id,actor_id,event,detail) SELECT organization_id,project_id,$10,'PROJECT_INVOICE_CREATED',jsonb_build_object('invoiceId',id,'amountKobo',amount_kobo,'status',status) FROM inserted) SELECT id FROM inserted`,
    [
      invoiceId,
      id(input.projectId),
      values.dueOn,
      values.items
        .map((i) => i.description)
        .join("; ")
        .slice(0, 2000),
      values.total,
      input.issue ? "OPEN" : "DRAFT",
      number,
      JSON.stringify(values.items),
      JSON.stringify(values.instalments),
      a.id,
    ],
  );
  if (!rows.length) throw Error("Project unavailable.");
  refresh();
  return { id: invoiceId };
}
export async function projectInvoiceStateAction(
  invoiceId: string,
  action: "issue" | "void",
) {
  const a = await requireAdminCapability("manage_custom");
  if (!["issue", "void"].includes(action))
    throw Error("Invalid invoice action.");
  const rows = await query(
    `WITH changed AS(UPDATE custom_invoices SET status=CASE WHEN $2='issue' THEN 'OPEN' ELSE 'VOID' END,issued_at=CASE WHEN $2='issue' THEN now() ELSE issued_at END WHERE id=$1 AND version=2 AND (($2='issue' AND status='DRAFT') OR ($2='void' AND status IN('DRAFT','OPEN') AND paid_kobo=0 AND NOT EXISTS(SELECT 1 FROM custom_invoice_payments WHERE invoice_id=$1 AND (state IN('initializing','ready','unknown','review') OR state='success' AND refunded_kobo<amount_kobo)))) RETURNING *) INSERT INTO custom_audit(organization_id,project_id,actor_id,event,detail) SELECT organization_id,project_id,$3,'PROJECT_INVOICE_'||upper($2),jsonb_build_object('invoiceId',id) FROM changed RETURNING id`,
    [id(invoiceId), action, a.id],
  );
  if (!rows.length)
    throw Error(
      "Invoice changed or has payment activity. Review before modifying.",
    );
  refresh();
}

export async function reconcileProjectPaymentAction(reference: string) {
  await requireAdminCapability("manage_custom");
  if (!/^jktl_project_[a-f0-9]{64}$/.test(reference))
    throw Error("Invalid payment reference.");
  const { verifyPortalPayment } = await import("@/lib/custom/portal-billing");
  if (!(await verifyPortalPayment(reference)))
    throw Error("Payment unavailable.");
  refresh();
}

export async function completeProjectPaymentReviewAction(invoiceId: string, reason: string) {
  const a=await requireAdminCapability('manage_custom');
  const detail=text(reason,1000);
  if(detail.length<20)throw Error('Enter the reconciliation evidence and decision (at least 20 characters).');
  const rows=await query(`WITH changed AS(UPDATE custom_invoices i SET payment_review=false WHERE i.id=$1 AND i.payment_review=true AND NOT EXISTS(SELECT 1 FROM custom_invoice_payments p WHERE p.invoice_id=i.id AND p.state IN('initializing','ready','unknown','review')) RETURNING i.*) INSERT INTO custom_audit(organization_id,project_id,actor_id,event,detail) SELECT organization_id,project_id,$2,'PROJECT_RECONCILIATION_COMPLETED',jsonb_build_object('invoiceId',id,'reason',$3::text,'paidKobo',paid_kobo) FROM changed RETURNING id`,[id(invoiceId),a.id,detail]);
  if(!rows.length)throw Error('Resolve pending or unallocated transactions before completing reconciliation.');refresh();
}
