import "server-only";
import { unstable_cache } from "next/cache";
import { loadInvestorReport } from "./service";
import { reportPeriod } from "./model";
/** Authorization happens in the page before this aggregate-only cache is read. Saved reports bypass it. */
export const loadDashboardReport = unstable_cache(
  async (from: string, to: string) =>
    loadInvestorReport(reportPeriod(from, to)),
  ["company-insights-v076"],
  { revalidate: 60, tags: ["company-insights"] },
);
