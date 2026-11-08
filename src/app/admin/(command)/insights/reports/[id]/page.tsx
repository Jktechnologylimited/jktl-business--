import { guardAdminPage } from "@/lib/admin-page-guard";
import { getAdminSession } from "@/lib/admin-session";
import { can } from "@/lib/admin-permissions";
import { readInvestorReport } from "@/lib/investor/service";
import { InvestorDashboard } from "@/components/admin/investor/InvestorDashboard";
import { notFound } from "next/navigation";
import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "JKTL Investor Report Snapshot",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await guardAdminPage("view_insights");
  const report = await readInvestorReport((await params).id);
  if (!report) notFound();
  const actor = await getAdminSession(),
    allowed = actor && can(actor.role, "export_insights", actor.permissions);
  return (
    <div className="space-y-6 text-ink">
      <header>
        <Link href="/admin/insights" className="text-blue-600 underline">
          Back to company insights
        </Link>
        <h1 className="my-4 text-3xl font-semibold">Saved investor report</h1>
        <p className="text-sm">
          {report.period.from}–{report.period.to} WAT · snapshot generated{" "}
          {new Date(report.generatedAt).toLocaleString("en-NG", {
            timeZone: "Africa/Lagos",
          })}{" "}
          WAT
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Frozen management information. Later payments and account changes will
          not rewrite this report.
        </p>
        <p className="mt-2 break-all text-xs text-ink-muted">
          Report {report.id} · SHA-256 {report.digest}
        </p>
        {allowed && (
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              className="rounded-lg bg-primary px-5 py-3 font-semibold text-on-primary"
              href={
                "/admin/insights/reports/" + report.id + "/download?format=pdf"
              }
            >
              Download PDF with charts
            </a>
            <a
              className="rounded-lg border border-border px-5 py-3 font-semibold"
              href={
                "/admin/insights/reports/" + report.id + "/download?format=csv"
              }
            >
              Download aggregate CSV
            </a>
          </div>
        )}
      </header>
      <InvestorDashboard report={report} />
    </div>
  );
}
