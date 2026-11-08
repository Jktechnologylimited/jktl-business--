import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFINITIONS,
  LIMITATIONS,
  monthlySeries,
  type InvestorReport,
} from "./model";
export async function investorPdf(report: InvestorReport) {
  const doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle("JKTL investor management report");
  doc.setAuthor("JK Technology Limited");
  doc.setSubject("Private, unaudited aggregate management information");
  doc.setCreationDate(new Date(report.generatedAt));
  const navy = rgb(0.035, 0.07, 0.16),
    gold = rgb(0.7, 0.55, 0.2),
    muted = rgb(0.35, 0.39, 0.45);
  let page!: PDFPage,
    y = 0;
  const clean = (v: unknown) =>
    String(v ?? "")
      .replaceAll("₦", "NGN ")
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]/g, " ");
  const newPage = (title: string) => {
    page = doc.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 770, width: 595, height: 72, color: navy });
    page.drawText("JK TECHNOLOGY LIMITED", {
      x: 42,
      y: 810,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText(clean(title), {
      x: 42,
      y: 786,
      size: 17,
      font: bold,
      color: rgb(1, 1, 1),
    });
    y = 744;
  };
  const line = (text: unknown, size = 10, emphasis = false) => {
    const words = clean(text)
      .split(/\s+/)
      .flatMap((word) => word.match(/.{1,65}/g) || []);
    let current = "";
    const rows: string[] = [];
    for (const word of words) {
      const next = current ? current + " " + word : word;
      if (
        (emphasis ? bold : font).widthOfTextAtSize(next, size) > 511 &&
        current
      ) {
        rows.push(current);
        current = word;
      } else current = next;
    }
    rows.push(current);
    for (const row of rows) {
      if (y < 62) newPage("Report continued");
      page.drawText(row, {
        x: 42,
        y,
        size,
        font: emphasis ? bold : font,
        color: emphasis ? navy : muted,
      });
      y -= size + 6;
    }
    y -= 3;
  };
  const money = (n: number) =>
    "NGN " +
    new Intl.NumberFormat("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n / 100);
  const chart = (
    title: string,
    rows: { label: string; value: number }[],
    currency = false,
  ) => {
    if (y < 280) newPage("Charts");
    line(title, 13, true);
    const left = 56,
      bottom = y - 135,
      width = 475,
      height = 115,
      actualMax = Math.max(0, ...rows.map((r) => r.value)),
      max = Math.max(1, actualMax);
    page.drawLine({
      start: { x: left, y: bottom },
      end: { x: left + width, y: bottom },
      color: muted,
      thickness: 0.6,
    });
    for (let i = 0; i < rows.length; i++) {
      const band = width / Math.max(1, rows.length),
        h = (rows[i].value / max) * height;
      page.drawRectangle({
        x: left + i * band + 4,
        y: bottom,
        width: Math.max(2, band - 9),
        height: Math.max(h, rows[i].value > 0 ? 1 : 0),
        color: gold,
      });
      page.drawText(clean(rows[i].label), {
        x: left + i * band + 2,
        y: bottom - 13,
        size: 6,
        font,
        color: muted,
      });
    }
    page.drawText(clean(currency ? money(actualMax) : String(actualMax)), {
      x: left,
      y: bottom + height + 8,
      size: 8,
      font,
      color: muted,
    });
    y = bottom - 32;
  };
  newPage("Investor management report");
  try {
    const logo = await doc.embedPng(
      await readFile(join(process.cwd(), "public/jktl-logo.png")),
    );
    page.drawImage(logo, { x: 480, y: 786, width: 33, height: 33 });
  } catch {
    /* Wordmark remains. */
  }
  line("PRIVATE / UNAUDITED / FOR DISCUSSION", 10, true);
  line("Report ID: " + report.id);
  line(
    "Generated: " +
      new Date(report.generatedAt).toLocaleString("en-NG", {
        timeZone: "Africa/Lagos",
      }) +
      " WAT",
  );
  line("Period: " + report.period.from + " to " + report.period.to + " WAT");
  line(
    "Comparison: " +
      report.period.previousFrom +
      " to " +
      report.period.previousTo,
  );
  line(
    "Current-state figures are as of generation, including when the period filter is historical.",
  );
  const a = report.accounts.available ? report.accounts.data : null,
    r = report.receipts.available ? report.receipts.data : null,
    s = report.subscriptions.available ? report.subscriptions.data : null,
    e = report.activity.available ? report.activity.data : null;
  line("Recorded traction and financial evidence", 14, true);
  line("Registered businesses (current): " + (a?.total ?? "Unavailable"));
  line(
    "Published templates (current): " +
      (a?.published ?? "Unavailable") +
      "; managed Custom clients: " +
      (a?.custom ?? "Unavailable"),
  );
  line(
    "Recorded verified gross receipts in period: " +
      (r ? money(r.gross) : "Unavailable"),
  );
  line(
    "Refunds against those receipts as of generation: " +
      (r ? money(r.refunds) : "Unavailable"),
  );
  line(
    "Risk-excluded remaining balance: " + (r ? money(r.risk) : "Unavailable"),
  );
  line(
    "Retained before fees, tax and operating costs: " +
      (r ? money(r.retained) : "Unavailable"),
  );
  line("Verified website MRR (current): " + (s ? money(s.mrr) : "Unavailable"));
  line(
    "Website annualized run-rate, not a forecast: " +
      (s ? money(s.arr) : "Unavailable"),
  );
  line(
    "Amounts are covered payment evidence, not all-company recognized revenue or profit. Confirm live-mode provider and bank reconciliation before sharing.",
    9,
    true,
  );
  if (a)
    chart(
      "Business creation cohorts (current eligible population)",
      monthlySeries(report.period, a.series, "count").map((row) => ({
        label: row.month.slice(2),
        value: Number(row.count),
      })),
    );
  newPage("Cash evidence and product mix");
  if (r) {
    chart(
      "Recorded gross receipts by payment month",
      monthlySeries(report.period, r.series, "gross").map((row) => ({
        label: row.month.slice(2),
        value: Number(row.gross),
      })),
      true,
    );
    line(
      "Product | payments | gross | refunds | risk excluded | retained",
      9,
      true,
    );
    for (const row of r.products)
      line(
        `${row.product} | ${row.transactions} | ${money(row.gross)} | ${money(row.refunds)} | ${money(row.risk)} | ${money(row.retained)}`,
        9,
      );
    if (!r.products.length)
      line("No verified NGN receipts recorded in the selected period.");
    line(
      "Current registered businesses with retained covered receipts (all time): " +
        r.payingBusinesses,
    );
    line(
      `Duplicate evidence rows removed: ${r.duplicates}; incomplete evidence: ${r.invalid}; non-NGN records excluded: ${r.unsupported}.`,
    );
  } else line("Payment sources unavailable.");
  if (s)
    line(
      `Current website subscription evidence: ${s.verified} matched of ${s.active} active records; ${s.unverified} unmatched.`,
      10,
      true,
    );
  if (a) {
    line("Current account stages", 13, true);
    for (const row of a.stages) line(`${row.stage}: ${row.count}`);
    line(
      "Markets (current registered businesses): " +
        a.countries.map((row) => row.code + " " + row.count).join(" | "),
    );
  }
  newPage("Engagement and customer operations");
  if (e) {
    chart(
      "Recorded hosted-template website views",
      monthlySeries(report.period, e.series, "views").map((row) => ({
        label: row.month.slice(2),
        value: Number(row.views),
      })),
    );
    line(
      `Views ${e.views}; CTA events ${e.cta}; contact events ${e.contacts}; booking events ${e.bookings}; sites with events ${e.sites}.`,
    );
    line(
      `Accounts with their latest Tycoon save in the period: ${e.recentSavers}. Excludes guests, other games and Fantasy. This is not MAU.`,
    );
  } else line("Engagement sources unavailable.");
  if (report.portfolio.available) {
    line("Portfolio and support", 13, true);
    for (const [key, value] of Object.entries(report.portfolio.data))
      line(`${key}: ${value}`);
  } else line("Portfolio sources unavailable.");
  if (report.partners.available) {
    const p = report.partners.data;
    line("Partners and affiliates", 13, true);
    for (const row of p.programmes)
      line(`${row.programme || "Unspecified"} / ${row.status}: ${row.count}`);
    line("Available/reserved policy commission: " + money(p.available));
    line("Held policy commission: " + money(p.held));
    line("Confirmed policy payouts during period: " + money(p.paidOut));
  }
  if (report.activation || report.acquisition || report.receivables) {
    newPage("Activation and acquisition");
    if (report.activation?.available) {
      const m = report.activation.data;
      line(
        `First observed milestones since ${m.trackingSince}; selected period only.`,
        10,
        true,
      );
      line(
        `Registered ${m.registered}; selected ${m.selected}; published ${m.published}; verified website payments ${m.paid}.`,
      );
      line(
        "Independent milestone counts, not a conversion cohort. Existing accounts are not backdated; visitors unavailable.",
      );
    } else line("Milestone history unavailable.");
    if (report.receivables?.available) {
      const o = report.receivables.data;
      line(
        `Current issued Custom invoices: ${o.invoices}; outstanding ${money(o.outstanding)}; overdue ${money(o.overdue)}; under review ${money(o.underReview)}. Receivables are not ARR.`,
        10,
        true,
      );
    }
    if (report.acquisition?.available) {
      line("First-touch referral accounts", 13, true);
      for (const row of report.acquisition.data.sources) {
        line(
          `${row.source} (${row.programme}): ${row.registered} current registrations; ${row.published} published; ${row.paying} paying in period; retained receipts ${money(row.retained)}.`,
        );
      }
      line(
        "Selected-period paying customers and receipts; current registration/publication counts. Acquisition costs and CAC unavailable.",
      );
    } else line("Referral sources unavailable.");
  }
  newPage("Definitions, coverage and management notes");
  line("Source availability", 13, true);
  for (const key of [
    "accounts",
    "receipts",
    "subscriptions",
    "activity",
    "partners",
    "portfolio",
  ] as const)
    line(key + ": " + (report[key].available ? "available" : "unavailable"));
  line("Important reporting limits", 13, true);
  for (const note of LIMITATIONS) line("- " + note, 9);
  line("Metric definitions", 13, true);
  for (const [term, definition] of DEFINITIONS) {
    line(term, 10, true);
    line(definition, 9);
  }
  if (report.notes) {
    line("Management notes", 13, true);
    line(report.notes, 10);
  }
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    pages[i].drawText(
      "JKTL | Private management report | " + (i + 1) + "/" + pages.length,
      { x: 42, y: 32, size: 8, font, color: muted },
    );
    pages[i].drawText(
      "Snapshot " +
        (report.id || "preview").slice(0, 8) +
        " | SHA-256 " +
        (report.digest || "").slice(0, 20),
      { x: 42, y: 19, size: 7, font, color: muted },
    );
  }
  return doc.save();
}
