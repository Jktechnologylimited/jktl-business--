import { requireAffiliateSession } from "@/lib/affiliate-session";
import { query } from "@/lib/custom/service";
export async function GET() {
  let p;
  try {
    p = await requireAffiliateSession();
  } catch {
    return new Response("Sign in required", { status: 401 });
  }
  const rows = await query(
    "SELECT reference,product,currency,net_kobo,rate_bps,amount_kobo,status,created_at FROM distribution_ledger WHERE affiliate_id=$1 ORDER BY created_at DESC LIMIT 10000",
    [p.id],
  );
  const keys = [
    "reference",
    "product",
    "currency",
    "net_kobo",
    "rate_bps",
    "amount_kobo",
    "status",
    "created_at",
  ];
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const csv = [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
  ].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="jktl-verified-earnings.csv"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
