// Browser fixture: no real bank, customer, email or payment calls.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  http = require("node:http");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, ".."),
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jktl-invoice-ui-"));
const file = (n, s) => {
  const p = path.join(dir, n);
  fs.writeFileSync(p, s);
  return p;
};
const loader = file(
  "loader.cjs",
  `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText`,
);
const store = file(
  "store.js",
  `const state={mode:'live',data:{organization:{id:'fixture'},customers:[{id:'customer',name:'Customer'}],invoices:[],invoiceItems:[]},addInvoice:async input=>{if(!window.fixtureReady)throw Error('Receiving bank account required');if(!window.fixtureCreateOk)throw Error('Server rejected invoice; please retry.');window.createdInvoice=input;}};export function useBusinessStore(f){return f(state)}`,
);
const toast = file(
  "toast.js",
  `export function useToastStore(f){return f({show:m=>window.toast=m})}`,
);
const actions = file(
  "actions.js",
  `export async function getPaymentSettingsAction(){return{ok:true,data:{bankCode:'058',accountNumber:'0000000000',accountName:'Fixture Owner',subaccountCode:window.fixtureReady?'ACCT_fixture':''}}}`,
);
const link = file(
  "link.js",
  `import React from'react';export default function Link(p){return React.createElement('a',p,p.children)}`,
);
const language = file(
  "lang.js",
  `import React from'react';export function T({children}){return React.createElement(React.Fragment,null,children)}`,
);
const entry = file(
  "entry.js",
  `import React from'react';import{createRoot}from'react-dom/client';import Invoices from${JSON.stringify(path.join(root, "src/app/business/invoices/page.tsx"))};createRoot(document.getElementById('app')).render(React.createElement('main',{className:'mx-auto max-w-4xl p-4'},React.createElement(Invoices)));`,
);
require("next/dist/compiled/webpack/webpack").webpack(
  {
    mode: "development",
    entry,
    output: { path: dir, filename: "bundle.js" },
    module: {
      rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: loader }],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js", ".json"],
      modules: [path.join(root, "node_modules"), "node_modules"],
      alias: {
        "next/link": link,
        "@/components/i18n/LanguageProvider": language,
        "@/lib/store": store,
        "@/lib/toast": toast,
        "@/lib/actions/payment-settings-actions": actions,
        "@": path.join(root, "src"),
      },
    },
    devtool: false,
  },
  (error, stats) => {
    if (error || stats.hasErrors()) {
      console.error(error || stats.toString({ all: false, errors: true }));
      process.exitCode = 1;
      return;
    }
    let css = "";
    for (const p of fs.readdirSync(path.join(root, ".next/static/chunks")))
      if (p.endsWith(".css"))
        css += fs.readFileSync(
          path.join(root, ".next/static/chunks", p),
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
          : `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="app"></div><script src="/bundle.js"></script></body></html>`,
      );
    });
    server.listen(0, "127.0.0.1", async () => {
      let browser;
      try {
        browser = await chromium.launch({
          executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
          args: ["--no-sandbox"],
        });
        for (const [width, dark] of [
          [1440, false],
          [390, false],
          [390, true],
        ]) {
          const page = await browser.newPage({
              viewport: { width, height: 1000 },
              colorScheme: dark ? "dark" : "light",
            }),
            errors = [];
          page.on("pageerror", (e) => errors.push(e.message));
          await page.goto("http://127.0.0.1:" + server.address().port);
          if (dark)
            await page.evaluate(() =>
              document.documentElement.classList.add("dark"),
            );
          await page
            .getByRole("heading", {
              name: "Set up your receiving bank account",
            })
            .waitFor();
          if (
            !(await page
              .getByRole("button", { name: "Create", exact: true })
              .isDisabled())
          )
            throw Error("Create available without bank");
          if (
            (await page
              .getByRole("link", { name: "Add bank account" })
              .getAttribute("href")) !== "/business/settings?tab=payments"
          )
            throw Error("Bank setup link broken");
          await page.screenshot({
            path: path.join(dir, `bank-required-${width}-${dark}.png`),
            fullPage: true,
          });
          await page.evaluate(() => (window.fixtureReady = true));
          await page.getByRole("button", { name: "Check again" }).click();
          await page
            .getByRole("button", { name: "Create", exact: true })
            .click();
          await page
            .getByPlaceholder("e.g. Hair installation")
            .fill("Design service");
          const numbers = page.locator('input[type="number"]');
          await numbers.nth(1).fill("1000");
          await page
            .locator("form")
            .getByRole("button", { name: "Create invoice", exact: true })
            .click();
          await page
            .getByRole("alert")
            .filter({ hasText: "Server rejected invoice" })
            .waitFor();
          if (await page.evaluate(() => window.toast))
            throw Error("False success on server rejection");
          await page.evaluate(() => (window.fixtureCreateOk = true));
          await page
            .locator("form")
            .getByRole("button", { name: "Create invoice", exact: true })
            .click();
          await page.waitForFunction(() => window.toast === "Invoice created");
          if (
            !(await page.evaluate(
              () => window.createdInvoice.items[0].unitPriceKobo === 100000,
            ))
          )
            throw Error("Wrong amount");
          if (
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            )
          )
            throw Error("Horizontal overflow");
          if (errors.length) throw Error(errors.join("\n"));
          console.log(
            JSON.stringify({
              width,
              dark,
              bankGate: true,
              serverFailureVisible: true,
              confirmedCreation: true,
            }),
          );
          await page.close();
        }
        console.log("Screenshots: " + dir);
      } catch (e) {
        console.error(e);
        process.exitCode = 1;
      } finally {
        await browser?.close();
        server.close();
      }
    });
  },
);
