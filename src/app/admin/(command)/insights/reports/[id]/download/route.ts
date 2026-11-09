import { getAdminSession } from "@/lib/admin-session";
import { can } from "@/lib/admin-permissions";
import { readInvestorReport } from "@/lib/investor/service";
import { reportCsv } from "@/lib/investor/model";
import { investorPdf } from "@/lib/investor/pdf";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getAdminSession();
  if (!actor)
    return Response.json(
      { error: "Sign in to the team workspace." },
      { status: 401 },
    );
  if (
    !can(actor.role, "view_company_finance", actor.permissions) ||
    !can(actor.role, "view_insights", actor.permissions) ||
    !can(actor.role, "export_insights", actor.permissions)
  )
    return Response.json(
      { error: "Report export is not permitted for this role." },
      { status: 403 },
    );
  const format = new URL(req.url).searchParams.get("format") || "pdf";
  if (!["pdf", "csv"].includes(format))
    return Response.json({ error: "Choose PDF or CSV." }, { status: 400 });
  try {
    const report = await readInvestorReport((await params).id);
    if (!report)
      return Response.json({ error: "Report not found." }, { status: 404 });
    const filename = `jktl-investor-${report.period.from}-${report.period.to}-${report.id?.slice(0, 8)}.${format}`;
    const headers = {
      "Content-Type":
        format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
    };
    return format === "pdf"
      ? new Response(Buffer.from(await investorPdf(report)), { headers })
      : new Response(reportCsv(report), { headers });
  } catch {
    return Response.json(
      { error: "Could not verify or render this saved report." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
