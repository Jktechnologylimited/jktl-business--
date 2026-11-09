// Synthetic local fixtures. No database, email, analytics or payment provider connections.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, ".."),
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jktl-company-ui-"));
const file = (n, s) => {
  const p = path.join(dir, n);
  fs.writeFileSync(p, s);
  return p;
};
const loader = file(
  "ts.cjs",
  `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText`,
);
const actions = file(
  "actions.js",
  `const save=async form=>{window.lastFinanceSubmission=Object.fromEntries(form.entries())};export const recordCompanyCostsAction=save,reverseCompanyCostAction=save,saveCostCategoryAction=save,attestFinancePeriodAction=save,reconcileMerchantPaymentAction=save,reconcileMerchantFeeAction=save,saveGrowthCampaignAction=save,saveWebsiteFeeDraftAction=save;`,
);
const queries = file(
  "query.js",
  `export async function query(sql){if(sql.includes('to_regclass'))return[{present:'company_cost_entries'}];if(sql.includes('company_cost_categories'))return[{id:'hosting',name:'Cloud hosting',classification:'DIRECT',enabled:true}];return[]}`,
);
const nav = file("nav.js", `export const unstable_rethrow=()=>{};`),
  crypto = file(
    "crypto.js",
    `export const randomUUID=()=>globalThis.crypto.randomUUID();`,
  );
const stages = [
  "gallery_visit",
  "template_preview",
  "template_selected",
  "registration_started",
  "registration_completed",
  "website_creation_started",
  "website_content_added",
  "website_published",
  "paid_plan_viewed",
  "checkout_started",
  "subscription_paid",
];
const section = (data) => ({ available: true, data });
const report = {
  merchantTransactions: section({
    gpv: 100000,
    payerTotal: 105000,
    successful: 1,
    grossFees: 5000,
    earnedFees: 5000,
    heldFees: 0,
    reviewCount: 0,
    adjustments: 0,
    processorCosts: 7000,
    missingProcessorCosts: 0,
    contribution: -2000,
    previousGpv: 0,
    previousFees: 0,
    refundTransactions: 0,
    payerRefunds: 0,
    disputedTransactions: 0,
    pendingAttempts: 1,
    failedAttempts: 0,
    excludedMode: 0,
    series: [{ day: "2026-11-08", gpv: 100000, fees: 5000 }],
    bySource: [{ source: "INVOICE", transactions: 1, gpv: 100000, fees: 5000 }],
  }),
  profitability: section({
    recordedCompanyReceipts: 50000,
    merchantFeeRevenue: 5000,
    directCosts: 17000,
    operatingExpenses: 1000,
    taxes: 0,
    revenueComplete: false,
    directComplete: false,
    opexComplete: false,
    taxComplete: false,
    streams: [{ product: "Website plans", receipts: 50000 }],
    costCategories: [
      { category_id: "hosting", classification: "DIRECT", cost: 10000 },
    ],
  }),
  executiveInventory: section({
    registered: 22,
    newRegistrations: 1,
    websitesCreated: 6,
    websitesPublished: 4,
    freeWebsiteAccounts: 3,
    paidCustomers: 1,
    paidServices: 1,
    recurringSnapshot: "2026-11-08",
  }),
  extendedFunnel: section({
    activeBusinesses: 1,
    trackingSince: "2026-11-08T00:00:00Z",
    cohortBrowsers: 6,
    stages: stages.map((stage, i) => ({
      stage,
      n: i + 1,
      people: Math.max(0, 6 - i),
      events: Math.max(0, 6 - i),
    })),
    cohort: stages.map((stage, i) => ({
      stage,
      n: i + 1,
      reached: Math.max(0, 6 - i),
    })),
  }),
  subscriptionLifecycle: section({
    new: 1,
    renewed: 0,
    upgraded: 0,
    downgraded: 0,
    currentCancelled: 0,
    currentExpired: 0,
    failedRenewals: 0,
    observedCancellations: 0,
    plans: [{ plan_id: "fixture", receipts: 50000, payments: 1 }],
  }),
  retention: section({ sufficient: false, startingMrr: 0 }),
  channelFinancials: section({
    recurringSnapshot: "2026-11-08",
    sources: [
      { name: "Example partner", programme: "partner", mrr: 10000, fees: 5000 },
    ],
  }),
  campaigns: section({
    campaigns: [
      {
        id: "launch",
        name: "Approved launch",
        browsers: 6,
        registered: 2,
        published: 1,
        paying: 1,
        receipts: 50000,
        transactionFees: 5000,
      },
    ],
  }),
};
const entry = file(
  "entry.js",
  `import React,{useEffect,useState}from'react';import{createRoot}from'react-dom/client';import{CompanyFinancePanel}from ${JSON.stringify(path.join(root, "src/components/admin/investor/CompanyFinancePanel.tsx"))};import{ActivationIntelligence}from ${JSON.stringify(path.join(root, "src/components/admin/investor/ActivationIntelligence.tsx"))};import{CompanyFinanceControls}from ${JSON.stringify(path.join(root, "src/components/admin/investor/CompanyFinanceControls.tsx"))};const report=${JSON.stringify(report)};if(new URLSearchParams(location.search).has('complete'))Object.assign(report.profitability.data,{revenueComplete:true,directComplete:true,opexComplete:true,taxComplete:true});function App(){const[controls,setControls]=useState(null);useEffect(()=>{CompanyFinanceControls({period:{from:'2026-11-01',to:'2026-11-08'}}).then(setControls)},[]);return <><p>Isolated synthetic browser fixture</p><CompanyFinancePanel report={report}/><ActivationIntelligence report={report}/>{controls}</>};createRoot(document.getElementById('app')).render(<App/>);`,
);
require("next/dist/compiled/webpack/webpack").webpack(
  {
    mode: "development",
    plugins: [
      new (require("next/dist/compiled/webpack/webpack").webpack.NormalModuleReplacementPlugin)(
        /^node:crypto$/,
        crypto,
      ),
    ],
    entry,
    output: { path: dir, filename: "bundle.js" },
    devtool: false,
    module: {
      rules: [
        { test: /\.tsx?$/, exclude: /node_modules/, use: loader },
        { test: /entry\.js$/, use: loader },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js", ".json"],
      modules: [path.join(root, "node_modules")],
      alias: {
        "@/lib/actions/company-finance-actions": actions,
        "@/lib/custom/service": queries,
        "next/navigation": nav,
        "node:crypto": crypto,
        "@": path.join(root, "src"),
      },
    },
  },
  (error, stats) => {
    if (error || stats.hasErrors()) {
      console.error(error || stats.toString({ all: false, errors: true }));
      process.exitCode = 1;
      return;
    }
    let css = "";
    for (const name of fs.readdirSync(path.join(root, ".next/static/chunks")))
      if (name.endsWith(".css"))
        css += fs.readFileSync(
          path.join(root, ".next/static/chunks", name),
          "utf8",
        );
    const server = http.createServer((req, res) => {
      res.setHeader(
        "Content-Type",
        req.url === "/bundle.js" ? "text/javascript" : "text/html",
      );
      res.end(
        req.url === "/bundle.js"
          ? fs.readFileSync(path.join(dir, "bundle.js"))
          : `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body><main style="max-width:1100px;margin:auto;padding:16px"><div id="app"></div></main><script src="/bundle.js"></script>`,
      );
    });
    server.listen(0, "127.0.0.1", async () => {
      let browser;
      try {
        browser = await chromium.launch({
          executablePath: "/usr/bin/chromium",
          args: ["--no-sandbox"],
        });
        const base = `http://127.0.0.1:${server.address().port}`;
        for (const width of [1440, 390, 320]) {
          const p = await browser.newPage({
              viewport: { width, height: 900 },
              reducedMotion: "reduce",
            }),
            errors = [];
          p.on("pageerror", (e) => errors.push(e.message));
          await p.goto(base);
          await p
            .getByRole("heading", {
              name: "Merchant payments & JKTL profitability",
            })
            .waitFor();
          await p
            .getByRole("heading", {
              name: "Activation, subscription lifecycle & acquisition",
            })
            .waitFor();
          assert.match(
            await p
              .getByText("Transaction contribution", { exact: true })
              .locator("..")
              .innerText(),
            /-.*20\.00/,
          );
          assert.match(
            await p
              .getByText("Net result after recorded taxes", { exact: true })
              .locator("..")
              .innerText(),
            /Unavailable/,
          );
          for (const interval of ["week", "month", "year", "day"])
            await p.getByLabel("Chart interval").selectOption(interval);
          const controls = p
            .locator("details")
            .filter({
              has: p.locator("summary", {
                hasText:
                  "Company costs, payment reconciliation & period coverage",
              }),
            });
          await controls.locator("summary").first().click();
          await p
            .getByRole("heading", {
              name: "Record a company expense",
              exact: true,
            })
            .waitFor();
          await p
            .getByText("Import evidenced expenses (JSON or CSV)", {
              exact: true,
            })
            .click();
          await p
            .getByLabel("Expense file")
            .setInputFiles({
              name: "costs.csv",
              mimeType: "text/csv",
              buffer: Buffer.from(
                "category_id,incurred_on,amount,currency,economic_key,evidence\nhosting,2026-11-08,100,NGN,fixture-cost-001,Fixture supplier bill",
              ),
            });
          await p.getByText("1 rows ready for server validation.").waitFor();
          await p
            .getByRole("checkbox", { name: /I reviewed the costs/ })
            .check();
          await p
            .getByRole("button", { name: "Import validated costs" })
            .click();
          await p.waitForFunction(() => window.lastFinanceSubmission?.rows);
          assert.equal(
            JSON.parse(
              await p.evaluate(() => window.lastFinanceSubmission.rows),
            )[0].economic_key,
            "fixture-cost-001",
          );
          assert.equal(
            await p.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            true,
            `finance ${width} overflow`,
          );
          await p.screenshot({
            path: `/tmp/jktl-company-finance-${width}.png`,
            fullPage: true,
          });
          await p.goto(base + "/?complete=1");
          await p
            .getByText("Net result after recorded taxes", { exact: true })
            .waitFor();
          assert.match(
            await p
              .getByText("Net result after recorded taxes", { exact: true })
              .locator("..")
              .innerText(),
            /370\.00/,
          );
          assert.deepEqual(errors, []);
          await p.close();
          console.log(
            `Passed ${width}px: financial charts, incomplete/complete evidence, funnel, reconciliation controls and CSV import.`,
          );
        }
      } catch (e) {
        console.error(e);
        process.exitCode = 1;
      } finally {
        await browser?.close();
        server.close();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  },
);
