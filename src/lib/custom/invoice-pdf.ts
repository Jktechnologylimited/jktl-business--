import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { LineItem } from "./portal-model";
export async function invoicePdf(invoice: Record<string, unknown>) {
  const doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.035, 0.08, 0.18),
    gold = rgb(0.71, 0.55, 0.18);
  let page = doc.addPage([595, 842]),
    y = 790;
  const clean = (s: unknown) =>
    String(s ?? "")
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, " ");
  const line = (value: unknown, large = false) => {
    const text = clean(value);
    for (let i = 0; i < Math.max(1, text.length); i += 88) {
      if (y < 70) {
        page = doc.addPage([595, 842]);
        y = 790;
      }
      page.drawText(text.slice(i, i + 88), {
        x: 45,
        y,
        size: large ? 15 : 10,
        font: large ? bold : font,
        color: navy,
      });
      y -= large ? 25 : 17;
    }
  };
  try {
    const logo = await doc.embedPng(
      await readFile(join(process.cwd(), "public/jktl-logo.png")),
    );
    page.drawImage(logo, { x: 45, y: 765, width: 42, height: 42 });
  } catch {
    /* Wordmark remains if logo is unavailable. */
  }
  page.drawText("JK Technology Limited", {
    x: 100,
    y: 787,
    size: 19,
    font: bold,
    color: navy,
  });
  page.drawText("JKTL CUSTOM PROJECT INVOICE", {
    x: 100,
    y: 767,
    size: 10,
    font: bold,
    color: gold,
  });
  y = 730;
  line(`Invoice: ${invoice.invoice_number || invoice.id}`, true);
  line(`Customer: ${invoice.customer_name}`);
  line(`Project: ${invoice.project_name}`);
  line(
    `Issued: ${String(invoice.issued_at || "").slice(0, 10)}    Due: ${String(invoice.due_on).slice(0, 10)}`,
  );
  line(`Status: ${invoice.display_status || invoice.status}    Currency: NGN`);
  y -= 12;
  const money = (n: unknown) =>
    "NGN " +
    (Number(n) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  const items =
    Array.isArray(invoice.line_items) && invoice.line_items.length
      ? (invoice.line_items as LineItem[])
      : [
          {
            description: String(invoice.description),
            quantity: 1,
            unitKobo: Number(invoice.amount_kobo),
          },
        ];
  for (const item of items) {
    line(item.description, true);
    line(
      `${item.quantity} x ${money(item.unitKobo)} = ${money(item.quantity * item.unitKobo)}`,
    );
    y -= 6;
  }
  line(`Total: ${money(invoice.amount_kobo)}`, true);
  line(`Verified payments: ${money(invoice.paid_kobo)}`);
  line(
    `Outstanding: ${money(Number(invoice.amount_kobo) - Number(invoice.paid_kobo))}`,
    true,
  );
  if (Array.isArray(invoice.instalments) && invoice.instalments.length) {
    line("Agreed instalments", true);
    for (const row of invoice.instalments)
      line(`${row.dueOn}: ${money(row.amountKobo)}`);
  }
  y -= 15;
  line("Pay securely from your JKTL project dashboard.");
  line("Payments are made to JK Technology Limited through Paystack.");
  line("A browser redirect alone is not payment confirmation.");
  line("Support: info@jktl.com.ng | https://business.jktl.com.ng");
  doc.setTitle(`JKTL Invoice ${invoice.invoice_number || invoice.id}`);
  return doc.save();
}
