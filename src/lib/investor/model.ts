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
  reversed?: number;
  paidLedger?: number;
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
export type Activation = {
  trackingSince: string;
  registered: number;
  selected: number;
  published: number;
  paid: number;
};
export type Acquisition = {
  sources: {
    source: string;
    programme: string;
    registered: number;
    published: number;
    paying: number;
    gross: number;
    retained: number;
  }[];
};
export type Receivables = {
  outstanding: number;
  overdue: number;
  invoices: number;
  underReview: number;
};
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
  // Optional to keep existing immutable report snapshots readable.
  executiveInventory?: Section<{
    registered: number;
    newRegistrations: number;
    websitesCreated: number;
    websitesPublished: number;
    freeWebsiteAccounts: number;
    paidCustomers: number;
    paidServices: number;
    recurringSnapshot: string | null;
  }>;
  retention?: Section<{
    baselineDay: string | null;
    endDay: string | null;
    sufficient: boolean;
    startingMrr: number;
    retainedMrr: number;
    startingCustomers: number;
    churnedCustomers: number;
    lostMrr: number;
  }>;
  channelFinancials?: Section<{
    recurringSnapshot: string | null;
    sources: { name: string; programme: string; mrr: number; fees: number }[];
  }>;
  extendedFunnel?: Section<{
    cohort: { stage: string; n: number; reached: number }[];
    cohortBrowsers: number;
    stages: { stage: string; n: number; people: number; events: number }[];
    activeBusinesses: number;
    trackingSince: string;
  }>;
  subscriptionLifecycle?: Section<{
    new: number;
    renewed: number;
    upgraded: number;
    downgraded: number;
    currentCancelled: number;
    currentExpired: number;
    failedRenewals: number;
    observedCancellations: number;
    plans: { plan_id: string; receipts: number; payments: number }[];
  }>;
  campaigns?: Section<{
    campaigns: {
      id: string;
      name: string;
      browsers: number;
      registered: number;
      published: number;
      paying: number;
      receipts: number;
      transactionFees: number;
    }[];
  }>;
  merchantTransactions?: Section<MerchantTransactions>;
  profitability?: Section<ProfitabilityData>;
  collections?: Section<{
    gross: number;
    transactions: number;
    risk: number;
    legacyGross: number;
  }>;
  companyRecurring?: Section<{
    mrr: number;
    arr: number;
    services: number;
    products: { product: string; mrr: number; services: number }[];
    legacyHostingExcluded: number;
    customCandidatesExcluded: number;
  }>;
  conversion?: Section<{
    visitors: number;
    registered: number;
    selected: number;
    published: number;
    paid: number;
    coverage: string;
  }>;
  movements?: Section<{
    daysCompared: number;
    churnedMrr: number;
    newMrr: number;
    expansionMrr: number;
    contractionMrr: number;
    series: { day: string; net: number }[];
  }>;
  acquisitionCosts?: Section<{
    sources: {
      source: string;
      spend: number;
      newPaying: number;
      cac: number | null;
    }[];
    unallocatedSpend: number;
  }>;
  activation?: Section<Activation>;
  acquisition?: Section<Acquisition>;
  receivables?: Section<Receivables>;
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
    "Merchant GPV and fees",
    "Merchant GPV is successful live NGN invoice principal, excluding JKTL's surcharge. Payer total includes both. Merchant money never becomes JKTL revenue. Fees require original split evidence or a controlled evidenced confirmation; disputed, refunded or mismatched payments are held until allocation is reconciled. Processing charges are evidenced amounts, not estimated percentages. Settlement is not inferred from payment success.",
  ],
  [
    "Company management profitability",
    "Recorded retained company receipts plus eligible merchant fees, less recorded direct costs, operating expenses and taxes. Results use the existing recorded-receipts basis rather than full accrual recognition. Profit is unavailable without current owner-confirmed period coverage and known processing/risk evidence. Acquisition spend, paid policy commissions and recorded wholesale costs are reused; tenant expenses are excluded. Corrections append reversals, never rewrite historical amounts.",
  ],
  [
    "Expanded activation",
    "Eleven forward-recorded stages combine consented browser intent and verified account changes. Independent period counts are not one conversion cohort. The retained consenting-gallery cohort requires preceding stage signals; skipped steps or missing signals are coverage gaps, not proof of abandonment. No pre-installation path history or unknown UTM source is invented.",
  ],

  [
    "Verified covered recurring revenue",
    "Website plans, paid licensed Business Email matched to current orders, accepted active recurring Custom services with settled current invoices, and explicitly reconciled legacy hosting payments. Annual values normalize over their actual periods. Ambiguous overlap and missing payment evidence are excluded and disclosed. This is covered run-rate, not all-company recognized revenue.",
  ],
  [
    "Observed run-rate movements",
    "Daily snapshots compare identical service keys on consecutive WAT days. New, expansion, contraction and lost MRR are movements in covered paid service run-rate; source gaps skip comparisons rather than reporting false churn. No pre-installation history is fabricated.",
  ],
  [
    "Consented visitor cohort",
    "First-seen consenting browser identifiers in the selected period, linked at signup with a first-party cookie. Later selected/published/paid milestones are observed through snapshot time. The strict funnel requires prior stages. Identifiers expire after 30 days; these are not all visitors or distinct people.",
  ],
  [
    "Acquisition cost",
    "Verified spend entered by an authorized team member, allocated by referral account and spend date. CAC is spend divided by businesses whose first retained covered payment occurs in the period. Missing cost evidence or a zero customer denominator yields unavailable CAC. Costs can precede purchases; compare periods and attribution coverage before drawing conclusions.",
  ],
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
    "Activation milestones",
    "First observed registration, template selection, publication and verified website-plan payment after tracking installation. Period counts are independent milestones, not a single conversion cohort. Existing accounts are not backdated; historical visitors are unavailable.",
  ],
  [
    "Acquisition sources",
    "Current eligible businesses attributed by the existing first-touch referral ledger. Registered/published are current account counts; paying businesses and receipts use retained verified payments in the selected period. No commission policy or rate is changed; source CAC is unavailable without cost evidence.",
  ],
  [
    "Outstanding Custom invoices",
    "Current issued OPEN NGN Custom invoices less recorded payments, excluding drafts, voids and settled invoices. Overdue uses the WAT due date. Payment-review balances are included and flagged; these are receivables, not collections or ARR. Tenant sales invoices are excluded.",
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
  "Company financial results require owner-confirmed period coverage and actual cost evidence. They use recorded receipts, not full accrual accounting. Unallocated per-customer/plan contribution, burn and runway remain unavailable.",
  "Platform-wide unique users, DAU/MAU, guest-game traffic, retention and LTV are unavailable. Conversion covers consenting browsers only. CAC uses evidenced, attributed costs and first retained payments in the selected period; cost coverage may be incomplete.",
  "Historical MRR before installation is not reconstructed. Consecutive daily evidence snapshots measure observed service run-rate movements going forward, not cancellation intent or recognized accounting revenue.",
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
            "reversed",
            "paidLedger",
            "gpv",
            "payerTotal",
            "grossFees",
            "earnedFees",
            "heldFees",
            "adjustments",
            "processorCosts",
            "contribution",
            "previousGpv",
            "previousFees",
            "payerRefunds",
            "recordedCompanyReceipts",
            "merchantFeeRevenue",
            "directCosts",
            "operatingExpenses",
            "taxes",
            "startingMrr",
            "retainedMrr",
            "lostMrr",
            "legacyGross",
            "spend",
            "cac",
            "newMrr",
            "churnedMrr",
            "expansionMrr",
            "contractionMrr",
            "unallocatedSpend",
            "outstanding",
            "overdue",
            "underReview",
          ].includes(metric)
            ? "integer NGN kobo"
            : "count",
        ]);
      else if (typeof value === "boolean")
        rows.push([
          key,
          metric,
          value ? "true" : "false",
          "evidence completeness",
        ]);
      else if (value === null)
        rows.push([key, metric, "Unavailable", "missing evidence"]);
      else if (typeof value === "string")
        rows.push([key, metric, value, "source metadata"]);
      else if (Array.isArray(value) && value.length) {
        rows.push([], [key, metric, "Breakdown"]);
        const columns = [
          ...new Set(value.flatMap((item) => Object.keys(item))),
        ];
        rows.push(
          columns.map((column) =>
            [
              "gross",
              "refunds",
              "risk",
              "retained",
              "mrr",
              "net",
              "spend",
              "cac",
              "gpv",
              "fees",
              "cost",
              "receipts",
              "transactionFees",
            ].includes(column)
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
  if (report.profitability?.available) {
    const p = profitabilityResult(report.profitability.data);
    rows.push(
      [],
      [
        "Company management results",
        "Recorded-receipts basis; coverage required",
      ],
    );
    for (const [key, value] of Object.entries(p))
      rows.push([
        "profitability",
        key,
        value === null
          ? "Unavailable — incomplete coverage or denominator"
          : value,
        key.endsWith("Margin") ? "percent" : "integer NGN kobo",
      ]);
  }
  rows.push([], ["Management notes", report.notes], [], ["Definitions"]);
  for (const entry of DEFINITIONS) rows.push(entry);
  rows.push([], ["Limitations"]);
  for (const text of LIMITATIONS) rows.push([text]);
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export const REPORT_RANGES = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["7days", "Last 7 days"],
  ["30days", "Last 30 days"],
  ["month", "This month"],
  ["last-month", "Last month"],
  ["year", "This year"],
  ["custom", "Custom date range"],
] as const;
export function presetPeriod(range: string, now = new Date()): Period {
  const today = watDay(now),
    d = new Date(today + "T00:00:00Z"),
    day = (x: Date) => x.toISOString().slice(0, 10);
  let from = today,
    to = today;
  if (range === "yesterday") {
    d.setUTCDate(d.getUTCDate() - 1);
    from = to = day(d);
  } else if (range === "7days" || range === "30days") {
    d.setUTCDate(d.getUTCDate() - (range === "7days" ? 6 : 29));
    from = day(d);
  } else if (range === "month") {
    from = today.slice(0, 8) + "01";
  } else if (range === "last-month") {
    d.setUTCDate(0);
    to = day(d);
    d.setUTCDate(1);
    from = day(d);
  } else if (range === "year") {
    from = today.slice(0, 4) + "-01-01";
  } else if (range !== "today")
    throw Error("Choose a supported reporting period.");
  return reportPeriod(from, to, now);
}
export type ProfitabilityData = {
  recordedCompanyReceipts: number;
  merchantFeeRevenue: number;
  directCosts: number;
  operatingExpenses: number;
  taxes: number;
  revenueComplete: boolean;
  directComplete: boolean;
  opexComplete: boolean;
  taxComplete: boolean;
  streams: { product: string; receipts: number }[];
  costCategories: {
    category_id: string;
    classification: string;
    cost: number;
  }[];
};
export function profitabilityResult(p: ProfitabilityData) {
  const revenue = p.recordedCompanyReceipts + p.merchantFeeRevenue,
    gross =
      p.revenueComplete && p.directComplete ? revenue - p.directCosts : null,
    operating =
      gross !== null && p.opexComplete ? gross - p.operatingExpenses : null,
    net = operating !== null && p.taxComplete ? operating - p.taxes : null;
  return {
    revenue,
    gross,
    operating,
    net,
    grossMargin:
      gross !== null && revenue > 0
        ? Math.round((gross / revenue) * 10000) / 100
        : null,
    operatingMargin:
      operating !== null && revenue > 0
        ? Math.round((operating / revenue) * 10000) / 100
        : null,
    netMargin:
      net !== null && revenue > 0
        ? Math.round((net / revenue) * 10000) / 100
        : null,
  };
}
export type MerchantTransactions = {
  gpv: number;
  payerTotal: number;
  successful: number;
  grossFees: number;
  adjustments: number;
  earnedFees: number;
  heldFees: number;
  reviewCount: number;
  processorCosts: number;
  missingProcessorCosts: number;
  contribution: number | null;
  previousGpv: number;
  previousFees: number;
  refundTransactions: number;
  payerRefunds: number;
  disputedTransactions: number;
  pendingAttempts: number;
  failedAttempts: number;
  excludedMode: number;
  series: { day: string; gpv: number; fees: number }[];
  bySource: {
    source: string;
    transactions: number;
    gpv: number;
    fees: number;
  }[];
};
