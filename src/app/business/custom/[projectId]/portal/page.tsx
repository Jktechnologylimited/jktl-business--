import { redirect } from "next/navigation";
import { owner, query } from "@/lib/custom/service";
import { id } from "@/lib/custom/model";
import { ProjectPortal } from "../../../../../../packages/custom-portal/ui";
import { verifyPortalPayment } from "@/lib/custom/portal-billing";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Custom project billing & support | JKTL Business",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ reference?: string }>;
}) {
  const s = await owner(),
    { projectId } = await params,
    { reference } = await searchParams;
  const p = (
    await query(
      "SELECT id,name FROM custom_projects WHERE id=$1 AND organization_id=$2",
      [id(projectId), s.organizationId],
    )
  )[0];
  if (!p) redirect("/business/custom");
  let notice = "";
  if (reference && /^jktl_project_[a-f0-9]{64}$/.test(reference)) {
    const permitted = await query(
      "SELECT 1 FROM custom_invoice_payments p JOIN custom_invoices i ON i.id=p.invoice_id WHERE p.reference=$1 AND i.project_id=$2 AND i.organization_id=$3",
      [reference, projectId, s.organizationId],
    );
    if (permitted.length)
      try {
        await verifyPortalPayment(reference);
        notice = "Your payment has been verified.";
      } catch {
        notice =
          "Your payment is awaiting verification. Refresh to check before paying again.";
      }
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-3xl font-semibold">
        {String(p.name)} · Billing & Support
      </h1>
      {notice && <p role="status">{notice}</p>}
      <ProjectPortal endpoint={"/api/v1/custom-projects/" + projectId} />
    </main>
  );
}
