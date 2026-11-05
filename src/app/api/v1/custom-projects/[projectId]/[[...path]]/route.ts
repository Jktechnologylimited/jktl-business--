import { after, NextResponse } from "next/server";
import { projectActor } from "@/lib/custom/portal-access";
import {
  portalBilling,
  portalInvoices,
  portalInvoice,
  portalPayments,
  initializePortalPayment,
  verifyPortalPayment,
} from "@/lib/custom/portal-billing";
import {
  portalCases,
  portalCase,
  createPortalCase,
  replyPortalCase,
  portalAttachments,
  uploadPortalAttachment,
  downloadPortalAttachment,
} from "@/lib/custom/portal-support";
import { invoicePdf } from "@/lib/custom/invoice-pdf";
import { query } from "@/lib/custom/service";
import { processSupportNotifications } from "@/lib/support/notifications";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ projectId: string; path?: string[] }> };
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
async function handle(request: Request, context: Context) {
  try {
    const { projectId, path = [] } = await context.params,
      method = request.method;
    const limit =
      path[0] === "support" && path[2] === "attachments" ? 705000 : 12000;
    if (Number(request.headers.get("content-length") || 0) > limit)
      return NextResponse.json(
        { error: "Request too large" },
        { status: 413, headers },
      );
    const raw = method === "POST" ? await request.text() : "";
    if (Buffer.byteLength(raw) > limit)
      return NextResponse.json(
        { error: "Request too large" },
        { status: 413, headers },
      );
    const body = raw ? JSON.parse(raw) : {};
    const scope =
      path[0] === "support"
        ? method === "GET"
          ? "support:read"
          : "support:write"
        : path[0] === "billing"
          ? "billing:read"
          : path[0] === "payments" || method === "POST"
            ? "invoices:pay"
            : "invoices:read";
    const actor = await projectActor(request, projectId, scope, raw);
    let data: unknown;
    if (method === "GET" && path.length === 1 && path[0] === "billing")
      data = await portalBilling(actor);
    else if (method === "GET" && path.length === 1 && path[0] === "invoices")
      data = await portalInvoices(actor);
    else if (method === "GET" && path.length === 1 && path[0] === "payments")
      data = await portalPayments(actor);
    else if (method === "GET" && path[0] === "invoices" && path.length === 2)
      data = await portalInvoice(actor, path[1]);
    else if (
      method === "GET" &&
      path[0] === "invoices" &&
      path[2] === "pdf" &&
      path.length === 3
    ) {
      const invoice = await portalInvoice(actor, path[1]);
      return new Response(Buffer.from(await invoicePdf(invoice)), {
        headers: {
          ...headers,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="JKTL-invoice-${invoice.id}.pdf"`,
        },
      });
    } else if (
      method === "POST" &&
      path[0] === "invoices" &&
      path[2] === "pay" &&
      path.length === 3
    )
      data = await initializePortalPayment(actor, path[1], body.amountKobo);
    else if (
      method === "POST" &&
      path[0] === "payments" &&
      path[1] === "verify" &&
      path.length === 2
    ) {
      if (typeof body.reference !== "string" || body.reference.length > 100)
        throw Error("Invalid payment reference.");
      const known = await query(
        `SELECT 1 FROM custom_invoice_payments p JOIN custom_invoices i ON i.id=p.invoice_id WHERE p.reference=$1 AND i.project_id=$2 AND i.organization_id=$3`,
        [body.reference, actor.projectId, actor.organizationId],
      );
      if (!known.length) throw Error("Payment unavailable.");
      data = { verified: await verifyPortalPayment(body.reference) };
    } else if (
      path[0] === "support" &&
      path[2] === "attachments" &&
      path.length === 3
    ) {
      if (method === "GET") data = await portalAttachments(actor, path[1]);
      else {
        data = await uploadPortalAttachment(actor, path[1], body);
        after(() => processSupportNotifications());
      }
    } else if (
      method === "GET" &&
      path[0] === "support" &&
      path[2] === "attachments" &&
      path.length === 4
    ) {
      const file = await downloadPortalAttachment(actor, path[1], path[3]);
      if (!file)
        return NextResponse.json(
          { error: "File not found" },
          { status: 404, headers },
        );
      return new Response(Buffer.from(String(file.body), "base64"), {
        headers: {
          ...headers,
          "Content-Type": String(file.mime),
          "Content-Disposition": `attachment; filename="${String(file.file_name)}"`,
        },
      });
    } else if (method === "GET" && path[0] === "support" && path.length === 1)
      data = await portalCases(actor);
    else if (method === "GET" && path[0] === "support" && path.length === 2)
      data = await portalCase(actor, path[1]);
    else if (method === "POST" && path[0] === "support" && path.length === 1) {
      data = { id: await createPortalCase(actor, body) };
      after(() => processSupportNotifications());
    } else if (
      method === "POST" &&
      path[0] === "support" &&
      path[2] === "replies" &&
      path.length === 3
    ) {
      await replyPortalCase(actor, path[1], body.message);
      data = { saved: true };
      after(() => processSupportNotifications());
    } else
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404, headers },
      );
    return NextResponse.json({ data }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const denied = /^(Sign in|Project access|Integration|Request origin)/.test(
      message,
    );
    const safe =
      /^(Invoice |Amount |Checkout |Payment |Invalid |Enter |Select |Instalments |Open a new|Support ticket |Choose |Check |Please |Project unavailable)/.test(
        message,
      );
    return NextResponse.json(
      {
        error: denied
          ? "Project access denied."
          : safe
            ? message
            : "Service temporarily unavailable. Please retry or contact JKTL support.",
      },
      { status: denied ? 401 : safe ? 409 : 503, headers },
    );
  }
}
export const GET = handle;
export const POST = handle;
