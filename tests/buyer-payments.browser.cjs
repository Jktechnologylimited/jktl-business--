// All bank, payment, email and policy services are isolated synthetic fixtures.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, ".."),
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jktl-buyer-ui-")),
  file = (n, s) => {
    const p = path.join(dir, n);
    fs.writeFileSync(p, s);
    return p;
  };
const loader = file(
  "ts.cjs",
  `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText`,
);
const quote = {
  invoiceId: "00000000-0000-4000-8000-000000000001",
  principalKobo: 7500000,
  invoiceTotalKobo: 7500000,
  receivedKobo: 0,
  balanceKobo: 7500000,
  feeKobo: 20000,
  processorFeeKobo: 0,
  buyerTotalKobo: 7520000,
  currency: "NGN",
  policyId: "test-only",
  policyVersion: "fixture",
  token: "fixture-full",
  locked: false,
};
const actions = file(
  "actions.js",
  `const original=${JSON.stringify(quote)};export async function invoiceCheckoutQuoteAction(id,amount){window.lastQuote=amount;if(amount>7500000)return{ok:false,error:'Choose a payment no greater than the outstanding balance.'};return{ok:true,data:{...original,principalKobo:amount,feeKobo:amount<500000?0:amount<5000000?10000:20000,buyerTotalKobo:amount+(amount<500000?0:amount<5000000?10000:20000),token:'fixture-'+amount}}}export async function initiateInvoicePaymentAction(...args){window.paymentAttempt=args;return{ok:false,error:'Synthetic payment is pending confirmation. Do not pay again.'}}export async function saveBuyerFeePolicyAction(form){window.savedDraft=Object.fromEntries(form.entries())}export async function activateBuyerFeePolicyAction(){throw Error('Never activate in a browser fixture')}export async function rollbackBuyerFeePolicyAction(){throw Error('Never change live policy in a browser fixture')}`,
);
const query = file(
    "query.js",
    `export async function query(sql){if(sql.includes('to_regclass'))return[{present:'fixture'}];if(sql.includes('merchant_fee_configuration'))return[{rev:0,active_policy_id:null}];if(sql.includes('FROM organizations'))return[{id:'00000000-0000-4000-8000-000000000002',name:'Example business'}];return[]}`,
  ),
  feeService = file("fee-service.js", `export const activationGate=()=>null;`);
const entry = file(
    "entry.js",
    `import React,{useState,useEffect}from'react';import{createRoot}from'react-dom/client';import{PayButton}from ${JSON.stringify(path.join(root, "src/app/pay/[id]/pay-button.tsx"))};import{BuyerFeePolicyControls}from ${JSON.stringify(path.join(root, "src/components/admin/investor/BuyerFeePolicyControls.tsx"))};function App(){const[panel,setPanel]=useState(null);useEffect(()=>{BuyerFeePolicyControls().then(setPanel)},[]);return new URLSearchParams(location.search).get('view')==='policy'?panel:<PayButton invoiceId='00000000-0000-4000-8000-000000000001' initialQuote={${JSON.stringify(quote)}}/>}createRoot(document.getElementById('app')).render(<App/>);`,
  ),
  nav = file("nav.js", `export const unstable_rethrow=()=>{};`);
require("next/dist/compiled/webpack/webpack").webpack(
  {
    mode: "development",
    entry,
    output: { path: dir, filename: "bundle.js" },
    devtool: false,
    module: {
      rules: [
        { test: /\.tsx?$|entry\.js$/, exclude: /node_modules/, use: loader },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js", ".json"],
      modules: [path.join(root, "node_modules")],
      alias: {
        "@/lib/actions/invoice-payment-actions": actions,
        "@/lib/actions/merchant-fee-actions": actions,
        "@/lib/custom/service": query,
        "@/lib/merchant-fees/service": feeService,
        "next/navigation": nav,
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
    for (const n of fs.readdirSync(path.join(root, ".next/static/chunks")))
      if (n.endsWith(".css"))
        css += fs.readFileSync(
          path.join(root, ".next/static/chunks", n),
          "utf8",
        );
    const server = http.createServer((req, res) => {
      const js = req.url === "/bundle.js";
      res.setHeader(
        "Content-Type",
        js ? "text/javascript" : "text/html;charset=utf-8",
      );
      res.end(
        js
          ? fs.readFileSync(path.join(dir, "bundle.js"))
          : `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body><main class="mx-auto max-w-3xl p-4"><div id="app"></div></main><script src="/bundle.js"></script>`,
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
          const p = await browser.newPage({ viewport: { width, height: 900 } }),
            errors = [];
          p.on("pageerror", (e) => errors.push(e.message));
          await p.goto(base);
          await p
            .getByRole("heading", { name: "Review your checkout" })
            .waitFor();
          await p.getByRole("button", { name: /Pay.*75,200/ }).waitFor();
          assert.equal(
            await p
              .locator("dl")
              .innerText()
              .then((s) => s.includes("JKTL platform fee")),
            true,
          );
          await p
            .getByLabel("Amount to pay toward this invoice (NGN)")
            .fill("20000");
          await p.getByRole("button", { name: /Pay.*20,100/ }).waitFor();
          await p.getByRole("button", { name: /Pay.*20,100/ }).click();
          await p.getByRole("alert").waitFor();
          assert.deepEqual(
            (await p.evaluate(() => window.paymentAttempt)).slice(1),
            [2000000, "fixture-2000000"],
          );
          assert.equal(
            await p.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            true,
          );
          await p.screenshot({
            path: `/tmp/jktl-buyer-checkout-${width}.png`,
            fullPage: true,
          });
          await p.goto(base + "/?view=policy");
          await p
            .getByText("Buyer-paid transaction fees", { exact: false })
            .first()
            .waitFor();
          await p.locator("summary").first().click();
          assert.equal(
            await p
              .getByRole("button", { name: "Approve activation", exact: true })
              .isDisabled(),
            true,
          );
          assert.equal(await p.getByLabel("Band 2 fee").inputValue(), "100.00");
          await p.getByLabel("Band 2 fee").fill("150");
          await p
            .getByRole("button", { name: "Save inactive draft version" })
            .click();
          await p.getByRole("status").waitFor();
          assert.equal(
            JSON.parse(await p.evaluate(() => window.savedDraft.bands))[1]
              .feeKobo,
            15000,
          );
          assert.equal(
            await p.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            true,
          );
          assert.deepEqual(errors, []);
          await p.screenshot({
            path: `/tmp/jktl-buyer-policy-${width}.png`,
            fullPage: true,
          });
          await p.close();
          console.log(
            `Passed ${width}px: transparent charges, partial re-quote, explicit confirmation, editable drafts and locked activation.`,
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
