"use server";
import { redirect } from "next/navigation";
import { requireAdminCapability } from "@/lib/admin-session";
import { reportPeriod } from "@/lib/investor/model";
import { saveInvestorReport } from "@/lib/investor/service";
export async function generateInvestorReportAction(form: FormData) {
  const actor = await requireAdminCapability("export_insights");
  const period = reportPeriod(
    String(form.get("from") || ""),
    String(form.get("to") || ""),
  );
  const report = await saveInvestorReport(
    actor.id,
    period,
    String(form.get("notes") || ""),
  );
  redirect("/admin/insights/reports/" + report.id);
}
