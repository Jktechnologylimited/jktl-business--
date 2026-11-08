export type Period = {
  from: string;
  to: string;
  start: string;
  end: string;
  previousStart: string;
  previousFrom: string;
  previousTo: string;
};
export type Monthly = {
  month: string;
  count?: number;
  gross?: number;
  refunds?: number;
  risk?: number;
  retained?: number;
  transactions?: number;
  views?: number;
};
export type Accounts = {
  total: number;
  published: number;
  started: number;
  drafts: number;
  notStarted: number;
  custom: number;
  customDomains: number;
  newPeriod: number;
  previousPeriod: number;
  stages: { stage: string; count: number }[];
  series: Monthly[];
  countries: { code: string; count: number }[];
};
export type Receipts = {
  gross: number;
  refunds: number;
  risk: number;
  retained: number;
  transactions: number;
  previousGross: number;
  payingBusinesses: number;
  duplicates: number;
  invalid: number;
  unsupported: number;
  series: Monthly[];
  products: {
    product: string;
    gross: number;
    refunds: number;
    risk: number;
    retained: number;
    transactions: number;
  }[];
};
export type Subscriptions = {
  mrr: number;
  arr: number;
  verified: number;
  active: number;
  unverified: number;
  plans: { plan: string; count: number }[];
};
export type Activity = {
  views: number;
  cta: number;
  contacts: number;
  bookings: number;
  sites: number;
  recentSavers: number;
  series: Monthly[];
};
export type Partners = {
  programmes: { programme: string; status: string; count: number }[];
  available: number;
  held: number;
  paidOut: number;
};
export type Portfolio = {
  customProjects: number;
  activeCustomProjects: number;
  domains: number;
  emailServices: number;
  openSupport: number;
  newSupport: number;
  renewalsDue: number;
  renewalsOverdue: number;
  missingRenewalDates: number;
  prospectInventory: number;
};
export type Section<T> =
  { available: true; data: T } | { available: false; reason: string };
export type InvestorReport = {
  version: 1;
  generatedAt: string;
  period: Period;
  accounts: Section<Accounts>;
  receipts: Section<Receipts>;
  subscriptions: Section<Subscriptions>;
  activity: Section<Activity>;
  partners: Section<Partners>;
  portfolio: Section<Portfolio>;
  notes: string;
  id?: string;
  digest?: string;
};
export const watDay = (now: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day
  );
}
export function reportPeriod(
  from?: string,
  to?: string,
  now = new Date(),
): Period {
  const today = watDay(now),
    endDay = to || today;
  const first = new Date(today + "T00:00:00Z");
  first.setUTCDate(1);
  first.setUTCMonth(first.getUTCMonth() - 11);
  const startDay = from || first.toISOString().slice(0, 10);
  if (
    !validDay(startDay) ||
    !validDay(endDay) ||
    endDay > today ||
    startDay > endDay
  )
    throw Error("Choose valid report dates ending no later than today.");
  const days = (Date.parse(endDay) - Date.parse(startDay)) / 86400000 + 1;
  if (days > 731) throw Error("Choose a report period of at most 24 months.");
  const previousFrom = new Date(Date.parse(startDay) - days * 86400000)
      .toISOString()
      .slice(0, 10),
    previousTo = new Date(Date.parse(startDay) - 86400000)
      .toISOString()
      .slice(0, 10);
  return {
    from: startDay,
    to: endDay,
    start: new Date(startDay + "T00:00:00+01:00").toISOString(),
    end: new Date(
      Date.parse(endDay + "T00:00:00+01:00") + 86400000,
    ).toISOString(),
    previousStart: new Date(previousFrom + "T00:00:00+01:00").toISOString(),
    previousFrom,
    previousTo,
  };
}
export function monthlySeries(
  period: Period,
  rows: Monthly[],
  value: keyof Monthly,
) {
  const map = new Map(rows.map((r) => [r.month, r]));
  const cursor = new Date(period.from.slice(0, 7) + "-01T00:00:00Z"),
    end = period.to.slice(0, 7),
    result: Monthly[] = [];
  while (cursor.toISOString().slice(0, 7) <= end) {
    const month = cursor.toISOString().slice(0, 7);
    result.push({
      ...map.get(month),
      month,
      [value]: Number(map.get(month)?.[value] || 0),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}
export function percent(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : null;
}
export function change(current: number, previous: number) {
  return previous > 0
    ? Math.round(((current - previous) / previous) * 1000) / 10
    : null;
}
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b, "en"))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonicalJson(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export function assertSafeNumbers(value: unknown) {
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) || !Number.isSafeInteger(value))
  )
    throw Error("Could not represent a source amount safely.");
  if (value && typeof value === "object")
    for (const v of Object.values(value)) assertSafeNumbers(v);
}
export const DEFINITIONS = [
  [
    "Registered businesses",
    "Current organizations with an active registered owner, excluding demo/unclaimed prospect sites. Monthly cohorts use organization creation dates for this current population, not historical active-user counts.",
  ],
  [
    "Template activation",
    "Started means selected/draft or published templates. Published excludes managed Custom clients. The self-serve denominator excludes Custom clients.",
  ],
  [
    "Recorded verified receipts",
    "NGN payment evidence from website plans, domain payments, paid Business Email orders and Custom invoices/payments. References and provider transaction IDs are deduplicated. Tenant sales, customer invoices, wallets and AI contract schedules are excluded.",
  ],
  [
    "Refunds and risk",
    "Recorded refunds as of generation against the selected receipt cohort, not refunds paid during that period. Remaining balances with uncleared risk are excluded from retained receipts. Retained is before fees, tax and operating costs; it is not profit.",
  ],
  [
    "Website MRR / ARR",
    "Current active, unexpired website subscriptions with matching verified payment evidence, excluding full refunds and uncleared risks. Actual annual payment amounts are normalized over 12 months; ARR is MRR × 12, not a forecast or all-company revenue.",
  ],
  [
    "Period and snapshot",
    "Payment and organization-creation charts use the selected WAT date range. Account stages, country, MRR, portfolio and outstanding commission balances are current snapshots, even for historical date filters. The previous period has equal calendar-day length.",
  ],
  [
    "Website engagement",
    "Recorded template website events, including repeated visits and possible automation. These are not verified unique visitors. Main-site and external Custom-site analytics are not included.",
  ],
  [
    "Game activity",
    "Accounts whose latest saved Tycoon progress was updated in the selected period. Guests, other games and the separate Fantasy database are not measured here. This is not DAU, MAU, retention or sessions.",
  ],
  [
    "Partner figures",
    "Current application statuses by programme and current policy-ledger commission balances. Payouts are confirmed policy payouts during the period. Legacy commission/payout records are excluded from these balances.",
  ],
];
export const LIMITATIONS = [
  "Unaudited management information, not audited financial statements or a valuation.",
  "Provider live/test mode is not uniformly stored across these ledgers. Reconcile live-mode provider and bank statements before external circulation.",
  "Receipt coverage excludes standalone legacy hosting, paused AI-receptionist schedules, offline payments not recorded with evidence, and services billed outside this database.",
  "Fees, tax, payroll, wholesale costs and complete operating expenses are not consolidated: gross margin, profit, burn and runway are unavailable.",
  "Platform-wide unique users, DAU/MAU, guest-game traffic, retention, attribution, CAC and LTV are unavailable from the current sources.",
  "Historical MRR and historical account-stage changes are not reconstructed. Generated reports preserve snapshots going forward.",
];
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function reportCsv(report: InvestorReport) {
  const rows: unknown[][] = [
    ["JKTL investor management report", "Unaudited"],
    ["Report ID", report.id || "Preview"],
    ["Generated at", report.generatedAt],
    ["Period WAT", report.period.from, report.period.to],
    ["SHA-256", report.digest || ""],
    [],
    ["Section", "Metric", "Value", "Unit / scope"],
  ];
  for (const [key, section] of Object.entries(report)) {
    if (!section || typeof section !== "object" || !("available" in section))
      continue;
    if (!section.available) {
      rows.push([key, "Unavailable", section.reason]);
      continue;
    }
    for (const [metric, value] of Object.entries(section.data)) {
      if (typeof value === "number")
        rows.push([
          key,
          metric,
          value,
          [
            "gross",
            "refunds",
            "risk",
            "retained",
            "previousGross",
            "mrr",
            "arr",
            "available",
            "held",
            "paidOut",
          ].includes(metric)
            ? "integer NGN kobo"
            : "count",
        ]);
      else if (Array.isArray(value) && value.length) {
        rows.push([], [key, metric, "Breakdown"]);
        const columns = [
          ...new Set(value.flatMap((item) => Object.keys(item))),
        ];
        rows.push(
          columns.map((column) =>
            ["gross", "refunds", "risk", "retained"].includes(column)
              ? column + " (NGN kobo)"
              : column,
          ),
        );
        for (const item of value)
          rows.push(columns.map((column) => item[column]));
        rows.push([], ["Section", "Metric", "Value", "Unit / scope"]);
      }
    }
  }
  rows.push([], ["Management notes", report.notes], [], ["Definitions"]);
  for (const entry of DEFINITIONS) rows.push(entry);
  rows.push([], ["Limitations"]);
  for (const text of LIMITATIONS) rows.push([text]);
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
