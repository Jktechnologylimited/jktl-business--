import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import { id } from "@/lib/custom/model";
import { invoicePdf } from "@/lib/custom/invoice-pdf";
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{invoiceId:string}>}) {
 try {await requireAdminCapability('manage_custom');}catch{return Response.json({error:'Access denied'},{status:403});}
 const {invoiceId}=await params;
 const invoice=(await query('SELECT * FROM custom_invoices WHERE id=$1',[id(invoiceId)]))[0];
 if(!invoice)return Response.json({error:'Invoice not found'},{status:404});
 return new Response(Buffer.from(await invoicePdf(invoice)),{headers:{'Content-Type':'application/pdf','Cache-Control':'private, no-store','Content-Disposition':`attachment; filename="JKTL-invoice-${invoice.id}.pdf"`,'X-Content-Type-Options':'nosniff'}});
}
