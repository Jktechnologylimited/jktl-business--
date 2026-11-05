import "server-only";
import { query, audit } from "./service";
import { id, amount, token } from "./model";
import {
  initializeDomainPayment,
  verifyTransaction,
  getDomainRefund,
} from "@/lib/paystack";
import { invoiceStatus, nextInvoicePayment } from "./portal-model";
import type { ProjectActor } from "./portal-access";
export async function portalInvoices(
  actor: ProjectActor,
): Promise<
  (Record<string, unknown> & {
    display_status: unknown;
    outstanding_kobo: number;
    next_payment_kobo: number;
  })[]
> {
  const rows = await query(
    "SELECT id,invoice_number,version,description,project_id,project_name,customer_name,amount_kobo,paid_kobo,currency,status,due_on,issued_at,paid_at,instalments,payment_review FROM custom_invoices WHERE project_id=$1 AND organization_id=$2 AND status<>'DRAFT' ORDER BY due_on DESC LIMIT 200",
    [actor.projectId, actor.organizationId],
  );
  return rows.map((row) => ({
    ...row,
    display_status: invoiceStatus(row),
    next_payment_kobo: nextInvoicePayment(row),
    outstanding_kobo: Math.max(
      0,
      Number(row.amount_kobo) - Number(row.paid_kobo),
    ),
  }));
}
export async function portalInvoice(
  actor: ProjectActor,
  invoiceId: string,
): Promise<
  Record<string, unknown> & {
    display_status: unknown;
    outstanding_kobo: number;
    next_payment_kobo: number;
  }
> {
  const rows = await query(
    "SELECT id,invoice_number,version,description,project_id,project_name,customer_name,amount_kobo,paid_kobo,currency,status,due_on,issued_at,paid_at,line_items,instalments,payment_review FROM custom_invoices WHERE id=$1 AND project_id=$2 AND organization_id=$3 AND status<>'DRAFT'",
    [id(invoiceId), actor.projectId, actor.organizationId],
  );
  if (!rows[0]) throw Error("Invoice unavailable.");
  const invoice = rows[0];
  return {
    ...invoice,
    display_status: invoiceStatus(invoice),
    next_payment_kobo: nextInvoicePayment(invoice),
    outstanding_kobo: Math.max(
      0,
      Number(invoice.amount_kobo) - Number(invoice.paid_kobo),
    ),
  };
}
export async function portalPayments(actor: ProjectActor) {
  return query(
    `SELECT p.id,p.invoice_id,p.reference,p.amount_kobo,p.refunded_kobo,p.currency,p.state,p.verified_at,p.created_at FROM custom_invoice_payments p JOIN custom_invoices i ON i.id=p.invoice_id WHERE i.project_id=$1 AND i.organization_id=$2 UNION ALL SELECT id,id,reference,amount_kobo,0,currency,'success',paid_at,created_at FROM custom_invoices WHERE project_id=$1 AND organization_id=$2 AND version=1 AND status='PAID' ORDER BY created_at DESC LIMIT 100`,
    [actor.projectId, actor.organizationId],
  );
}
export async function portalBilling(actor: ProjectActor) {
  const [project, services, invoices, payments] = await Promise.all([
    query(
      "SELECT p.id,p.name,p.website_url,p.status,o.name AS organization FROM custom_projects p JOIN organizations o ON o.id=p.organization_id WHERE p.id=$1 AND p.organization_id=$2",
      [actor.projectId, actor.organizationId],
    ),
    query(
      "SELECT id,name,category,description,amount_kobo,discount_kobo,interval,next_due_on,status FROM custom_services WHERE project_id=$1 AND organization_id=$2 ORDER BY next_due_on",
      [actor.projectId, actor.organizationId],
    ),
    portalInvoices(actor),
    portalPayments(actor),
  ]);
  const payable = invoices.filter((i) => i.status === "OPEN");
  return {
    project: project[0],
    services,
    invoices,
    payments,
    balanceKobo: payable.reduce((sum, i) => sum + i.outstanding_kobo, 0),
    overdueKobo: payable
      .filter((i) => i.display_status === "OVERDUE")
      .reduce((sum, i) => sum + i.outstanding_kobo, 0),
  };
}
export async function initializePortalPayment(
  actor: ProjectActor,
  invoiceId: string,
  requested?: unknown,
): Promise<{ url: string; reference?: string; legacy?: boolean }> {
  const invoice = await portalInvoice(actor, invoiceId);
  if (invoice.version !== 2) {
    const { initializeInvoice } = await import("./service");
    return {
      url: await initializeInvoice(
        invoiceId,
        actor.organizationId,
        actor.userId,
      ),
      legacy: true,
    };
  }
  if (invoice.status !== "OPEN" || invoice.payment_review)
    throw Error("Invoice is not available for payment. Contact support.");
  const charge = amount(requested ?? invoice.next_payment_kobo),
    reference = "jktl_project_" + token();
  if (charge > invoice.outstanding_kobo)
    throw Error("Amount exceeds the outstanding balance.");
  if (
    Array.isArray(invoice.instalments) &&
    invoice.instalments.length &&
    charge !== invoice.next_payment_kobo &&
    charge !== invoice.outstanding_kobo
  )
    throw Error(
      "Amount must cover the next agreed instalment or the full outstanding balance.",
    );
  const rows = await query(
    `WITH locked AS(SELECT * FROM custom_invoices WHERE id=$1 AND project_id=$2 AND organization_id=$3 AND status='OPEN' AND payment_review=false AND amount_kobo-paid_kobo >= $4 FOR UPDATE) INSERT INTO custom_invoice_payments(invoice_id,reference,amount_kobo,billing_email,state) SELECT id,$5,$4,$6,'initializing' FROM locked WHERE NOT EXISTS(SELECT 1 FROM custom_invoice_payments WHERE invoice_id=locked.id AND state IN('initializing','ready','unknown')) ON CONFLICT DO NOTHING RETURNING *`,
    [
      invoiceId,
      actor.projectId,
      actor.organizationId,
      charge,
      reference,
      actor.email,
    ],
  );
  if (!rows.length) {
    const pending = (
      await query(
        "SELECT reference,authorization_url,amount_kobo FROM custom_invoice_payments WHERE invoice_id=$1 AND state IN('initializing','ready','unknown')",
        [invoiceId],
      )
    )[0];
    if (pending?.authorization_url && Number(pending.amount_kobo) === charge)
      return {
        url: String(pending.authorization_url),
        reference: String(pending.reference),
      };
    throw Error(
      "Checkout pending. Verify the existing payment before retrying.",
    );
  }
  try {
    const base =
      process.env.NEXT_PUBLIC_APP_URL || "https://business.jktl.com.ng";
    let callbackUrl = `${base}/business/custom/${actor.projectId}/portal?reference=${reference}`;
    if (actor.integration) {
      const project = (
        await query(
          "SELECT website_url,portal_return_path FROM custom_projects WHERE id=$1 AND organization_id=$2",
          [actor.projectId, actor.organizationId],
        )
      )[0];
      const target = new URL(String(project.website_url));
      target.pathname = String(project.portal_return_path);
      target.search = "";
      target.hash = "";
      target.searchParams.set("jktl_reference", reference);
      callbackUrl = target.toString();
    }
    const result = await initializeDomainPayment({
      email: actor.email,
      amountKobo: charge,
      reference,
      callbackUrl,
      metadata: {
        type: "custom_project_invoice",
        invoiceId,
        projectId: actor.projectId,
        organizationId: actor.organizationId,
      },
    });
    const url = new URL(result.authorizationUrl);
    if (
      result.reference !== reference ||
      url.protocol !== "https:" ||
      url.hostname !== "checkout.paystack.com"
    )
      throw Error("Provider mismatch");
    await query(
      "UPDATE custom_invoice_payments SET state='ready',authorization_url=$2 WHERE reference=$1 AND state='initializing'",
      [reference, url.toString()],
    );
    await audit(
      actor.organizationId,
      actor.userId,
      "PROJECT_CHECKOUT_CREATED",
      { invoiceId, reference, amountKobo: charge },
      actor.projectId,
    );
    return { url: url.toString(), reference };
  } catch {
    await query(
      "UPDATE custom_invoice_payments SET state='unknown' WHERE reference=$1 AND state='initializing'",
      [reference],
    );
    await query(
      `INSERT INTO custom_outbox(event_key,organization_id,project_id,subject,detail) VALUES($1,$2,$3,'JKTL payment is pending','Your checkout is awaiting reconciliation. Please check the payment status before attempting another payment.') ON CONFLICT DO NOTHING`,
      ["payment-pending:" + reference, actor.organizationId, actor.projectId],
    );
    throw Error(
      "Checkout pending verification. Do not make a duplicate payment.",
    );
  }
}
export async function verifyPortalPayment(reference: string) {
  const p = (
    await query(
      `SELECT p.*,i.project_id,i.organization_id,i.status AS invoice_status FROM custom_invoice_payments p JOIN custom_invoices i ON i.id=p.invoice_id WHERE p.reference=$1`,
      [reference],
    )
  )[0];
  if (!p) return false;
  if (p.state === "success") return true;
  if (p.state === "review")
    throw Error("Payment requires team reconciliation.");
  const v = await verifyTransaction(reference),
    meta = v.metadata,
    paid = new Date(String(v.paid_at));
  if (
    v.reference !== reference ||
    Number(v.amount) !== Number(p.amount_kobo) ||
    v.currency !== "NGN" ||
    String(v.customer?.email || "").toLowerCase() !==
      String(p.billing_email).toLowerCase() ||
    meta?.type !== "custom_project_invoice" ||
    meta.invoiceId !== p.invoice_id ||
    meta.projectId !== p.project_id ||
    meta.organizationId !== p.organization_id
  )
    throw Error("Payment reconciliation mismatch.");
  if (v.status !== "success") {
    if (["failed", "abandoned"].includes(v.status)) {
      await query(
        "UPDATE custom_invoice_payments SET state='failed' WHERE reference=$1 AND state<>'success'",
        [reference],
      );
      await query(
        `INSERT INTO custom_outbox(event_key,organization_id,subject,detail) VALUES($1,$2,'JKTL invoice payment was not completed','Your payment was not completed. Review the invoice before trying again.') ON CONFLICT DO NOTHING`,
        ["payment-failed:" + reference, p.organization_id],
      );
    }
    await query(
      `INSERT INTO custom_outbox(event_key,organization_id,project_id,subject,detail) VALUES($1,$2,$3,'JKTL payment status update','The payment has not yet been confirmed. Check the project invoice before paying again.') ON CONFLICT DO NOTHING`,
      [
        "payment-status:" + reference + ":" + v.status,
        p.organization_id,
        p.project_id,
      ],
    );
    throw Error("Payment not confirmed yet.");
  }
  if (
    !/^\d{1,20}$/.test(String(v.id)) ||
    !Number.isFinite(paid.getTime()) ||
    paid.getTime() > Date.now() + 300000
  )
    throw Error("Invalid verified payment.");
  const changed = await query(
    `WITH locked AS(SELECT i.* FROM custom_invoices i WHERE i.id=$1 FOR UPDATE),paid AS(UPDATE custom_invoice_payments p SET state='success',provider_transaction=$3,verified_at=$4 FROM locked i WHERE p.reference=$2 AND p.state<>'success' AND i.status='OPEN' AND i.paid_kobo+p.amount_kobo<=i.amount_kobo RETURNING p.*),updated AS(UPDATE custom_invoices i SET paid_kobo=i.paid_kobo+p.amount_kobo,status=CASE WHEN i.paid_kobo+p.amount_kobo=i.amount_kobo THEN 'PAID' ELSE 'OPEN' END,paid_at=CASE WHEN i.paid_kobo+p.amount_kobo=i.amount_kobo THEN $4::timestamptz ELSE NULL END FROM paid p WHERE i.id=p.invoice_id RETURNING i.*),advanced AS(UPDATE custom_services s SET next_due_on=CASE s.interval WHEN 'MONTHLY' THEN (i.due_on+interval '1 month')::date WHEN 'ANNUAL' THEN (i.due_on+interval '1 year')::date ELSE i.due_on END,status=CASE WHEN s.interval='ONCE' THEN 'CANCELLED' ELSE s.status END FROM updated i WHERE s.id=i.service_id AND i.status='PAID' RETURNING s.id),logged AS(INSERT INTO custom_audit(organization_id,project_id,actor_id,event,detail) SELECT organization_id,project_id,'paystack','PROJECT_PAYMENT_VERIFIED',jsonb_build_object('invoiceId',id,'reference',$2::text,'amountKobo',(SELECT amount_kobo FROM paid)) FROM updated) INSERT INTO custom_outbox(event_key,organization_id,project_id,subject,detail) SELECT 'project-receipt:'||$2::text,organization_id,project_id,'JKTL verified payment receipt','Payment reference: '||$2::text||'. Paid NGN '||((SELECT amount_kobo FROM paid)/100.0)::text||'. Outstanding NGN '||((amount_kobo-paid_kobo)/100.0)::text||'.' FROM updated ON CONFLICT DO NOTHING RETURNING id`,
    [p.invoice_id, reference, String(v.id), paid.toISOString()],
  );
  if (
    !changed.length &&
    (
      await query(
        "SELECT state FROM custom_invoice_payments WHERE reference=$1",
        [reference],
      )
    )[0]?.state !== "success"
  ) {
    await query(
      `WITH reviewed AS(UPDATE custom_invoice_payments SET state='review',provider_transaction=$2,verified_at=$3 WHERE reference=$1 AND state NOT IN('success','review') RETURNING *),changed AS(UPDATE custom_invoices i SET payment_review=true FROM reviewed p WHERE i.id=p.invoice_id RETURNING i.*) INSERT INTO custom_audit(organization_id,project_id,actor_id,event,detail) SELECT organization_id,project_id,'paystack','PROJECT_PAYMENT_REVIEW',jsonb_build_object('invoiceId',id,'reference',$1::text) FROM changed`,
      [reference, String(v.id), paid.toISOString()],
    );
    throw Error("Payment requires team reconciliation.");
  }
  return true;
}
export async function handlePortalPaymentEvent(
  event: string,
  data: Record<string, unknown>,
) {
  const reference = typeof data.reference === "string" ? data.reference : "";
  if (event === "charge.success" && reference.startsWith("jktl_project_")) {
    try {
      if (!(await verifyPortalPayment(reference)))
        throw Error("Project payment unavailable");
    } catch (error) {
      if (
        (
          await query(
            "SELECT state FROM custom_invoice_payments WHERE reference=$1",
            [reference],
          )
        )[0]?.state !== "review"
      )
        throw error;
    }
    return true;
  }
  if (event === "refund.processed" && data.id) {
    // Retrieve authoritative refund details; a webhook's amount is never trusted.
    const refund = await getDomainRefund(String(data.id));
    const transaction = refund.transaction as
      Record<string, unknown> | undefined;
    const payment = (
      await query(
        "SELECT * FROM custom_invoice_payments WHERE provider_transaction=$1",
        [String(transaction?.id || "")],
      )
    )[0];
    if (!payment) return false;
    if (
      refund.status !== "processed" ||
      refund.currency !== "NGN" ||
      !/^\d+$/.test(String(refund.id))
    )
      throw Error("Refund requires reconciliation.");
    const value = amount(refund.amount);
    await query(
      `WITH locked AS(SELECT * FROM custom_invoice_payments WHERE id=$1 FOR UPDATE),inserted AS(INSERT INTO custom_invoice_refunds(provider_refund,payment_id,amount_kobo) SELECT $2,id,$3 FROM locked WHERE state='success' AND refunded_kobo+$3<=amount_kobo ON CONFLICT DO NOTHING RETURNING *),payment AS(UPDATE custom_invoice_payments p SET refunded_kobo=p.refunded_kobo+r.amount_kobo FROM inserted r WHERE p.id=r.payment_id RETURNING p.invoice_id,r.amount_kobo),changed AS(UPDATE custom_invoices i SET paid_kobo=i.paid_kobo-p.amount_kobo,status='OPEN',paid_at=NULL,payment_review=true FROM payment p WHERE i.id=p.invoice_id AND i.paid_kobo>=p.amount_kobo RETURNING i.*) INSERT INTO custom_audit(organization_id,project_id,actor_id,event,detail) SELECT organization_id,project_id,'paystack','PROJECT_PAYMENT_REFUNDED',jsonb_build_object('invoice',id,'refund',$2::text) FROM changed`,
      [payment.id, String(refund.id), value],
    );
    return true;
  }
  if (event.startsWith("charge.dispute.") && data.transaction) {
    const transaction =
      typeof data.transaction === "object"
        ? (data.transaction as Record<string, unknown>).id
        : data.transaction;
    const rows = await query(
      `UPDATE custom_invoices i SET payment_review=true FROM custom_invoice_payments p WHERE p.invoice_id=i.id AND p.provider_transaction=$1 RETURNING i.id`,
      [String(transaction)],
    );
    return rows.length > 0;
  }
  return false;
}
