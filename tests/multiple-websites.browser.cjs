// All server actions are mocked. This never creates/publishes a live website.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  http = require("node:http"),
  { chromium } = require("playwright"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jktl-websites-"));
const file = (n, s) => {
  const p = path.join(dir, n);
  fs.writeFileSync(p, s);
  return p;
};
const loader = file(
    "loader.cjs",
    `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText`,
  ),
  link = file(
    "link.js",
    `import React from'react';export default function Link({children,...props}){return React.createElement('a',props,children)}`,
  ),
  router = file(
    "router.js",
    `export function useRouter(){return{push:p=>{window.lastRoute=p}}}`,
  ),
  lang = file(
    "lang.js",
    `import React from'react';export function T({children}){return React.createElement(React.Fragment,null,children)}`,
  );
const canvas = file(
  "canvas.js",
  `import React from'react';export function TemplateCanvas(){return React.createElement('p',null,'Website preview fixture')}export function BeautyFields(){return null}`,
);
const store = file(
  "store.js",
  `export const primary={id:'primary-profile',organizationId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',displayName:'Primary Business',subdomain:'primary-site',websiteTemplateId:'blank-website',websiteRevision:0,published:true};const state={mode:'live',data:{profile:primary},setWebsiteProfile:p=>{window.primaryWasUpdated=true}};export function useBusinessStore(fn){return fn(state)}`,
);
const actions = file(
  "actions.js",
  `import{templateDraft}from ${JSON.stringify(path.join(root, "src/lib/website-templates.ts"))};import{primary}from'./store.js';const site='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';window.savedSites=[];export async function listBusinessWebsitesAction(){return{canManage:true,sites:[{id:'primary',kind:'primary',name:'Primary Business',subdomain:'primary-site',published:true,url:'https://primary-site.jktl.com.ng',templateId:'blank-website',editUrl:'/business/website/template',revision:0},{id:site,kind:'template',name:'Campaign',subdomain:'campaign-site',published:true,url:'https://campaign-site.jktl.com.ng',templateId:'blank-landing',editUrl:'/business/website/template?site='+site,revision:1},{id:'custom',kind:'custom',name:'Custom Project',published:true,url:'https://example.test',editUrl:'/business/custom/custom/portal',subdomain:'',templateId:'',revision:0}]}}
export async function checkWebsiteAddressAction(slug){return{available:slug!=='primary',error:'',suggestions:slug==='primary'?['primary-online','primary-studio']:[]}}
export async function createBusinessWebsiteAction(input){window.createdSite=input;return{ok:true,id:site}}
export async function saveAdditionalWebsiteAction(input){window.savedSites.push(input);return{ok:true,data:{...primary,id:input.id,subdomain:'campaign-site',websiteDocument:input.document,websiteTemplateId:input.templateId,websiteRevision:input.revision+1,published:input.published}}}
export async function saveWebsiteTemplateAction(){throw Error('Additional site incorrectly used primary save')}`,
);
const entry = file(
  "entry.js",
  `import React from'react';import{createRoot}from'react-dom/client';import{SiteList}from${JSON.stringify(path.join(root, "src/components/websites/site-list.tsx"))};import{CreateWebsite}from${JSON.stringify(path.join(root, "src/components/websites/create-website.tsx"))};import{TemplateEditor}from${JSON.stringify(path.join(root, "src/components/templates/TemplateEditor.tsx"))};import{primary}from'./store.js';import{templateDraft}from${JSON.stringify(path.join(root, "src/lib/website-templates.ts"))};const mode=new URLSearchParams(location.search).get('view');const site='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';createRoot(document.getElementById('app')).render(React.createElement('main',{className:'mx-auto max-w-5xl p-4 sm:p-8'},mode==='create'?React.createElement(CreateWebsite,{selected:'blank-website',businessName:'Primary'}):mode==='edit'?React.createElement(TemplateEditor,{initialProfile:{...primary,id:site,subdomain:'campaign-site',websiteTemplateId:'blank-website',websiteDocument:templateDraft('blank-website','Campaign'),published:false},selectedId:'blank-website',siteId:site}):React.createElement(SiteList,{mode:'live'})));`,
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
        "next/navigation": router,
        "@/components/i18n/LanguageProvider": lang,
        "./BeautyFields": canvas,
        "./TemplateCanvas": canvas,
        "@/lib/store": store,
        "@/lib/actions/multiple-website-actions": actions,
        "@/lib/actions/website-template-actions": actions,
        "@": path.join(root, "src"),
      },
    },
    devtool: false,
  },
  (err, stats) => {
    if (err || stats.hasErrors()) {
      console.error(err || stats.toString({ all: false, errors: true }));
      process.exitCode = 1;
      return;
    }
    let css = "";
    for (const f of fs.readdirSync(path.join(root, ".next/static/chunks")))
      if (f.endsWith(".css"))
        css += fs.readFileSync(
          path.join(root, ".next/static/chunks", f),
          "utf8",
        );
    const server = http.createServer((req, res) => {
      res.setHeader(
        "Content-Type",
        req.url === "/bundle.js"
          ? "text/javascript"
          : "text/html;charset=utf-8",
      );
      res.end(
        req.url === "/bundle.js"
          ? fs.readFileSync(path.join(dir, "bundle.js"))
          : '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
              css +
              '</style></head><body><div id="app"></div><script src="/bundle.js"></script></body></html>',
      );
    });
    server.listen(0, "127.0.0.1", async () => {
      let b;
      try {
        b = await chromium.launch({
          executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
          args: ["--no-sandbox"],
        });
        const base = "http://127.0.0.1:" + server.address().port;
        for (const [width, dark] of [
          [1440, false],
          [390, false],
          [390, true],
        ]) {
          const p = await b.newPage({
            viewport: { width, height: 1000 },
            colorScheme: dark ? "dark" : "light",
          });
          const errors = [];
          p.on("pageerror", (e) => errors.push(e.message));
          await p.goto(base);
          await p
            .getByRole("heading", { name: "Campaign", exact: true })
            .waitFor();
          if ((await p.getByRole("link", { name: /Upgrade/ }).count()) < 4)
            throw Error("Upgrade links hidden");
          for (const url of [
            "https://primary-site.jktl.com.ng",
            "https://campaign-site.jktl.com.ng",
            "https://example.test",
          ])
            if (
              !(await p
                .locator('a[href="' + url + '"]')
                .first()
                .isVisible())
            )
              throw Error("Website link hidden");
          const dims = await p.evaluate(() => ({
            width: innerWidth,
            scroll: document.documentElement.scrollWidth,
          }));
          if (dims.scroll > width) throw Error("Site list overflow");
          await p.screenshot({
            path: path.join(dir, `websites-${width}-${dark}.png`),
            fullPage: true,
          });
          await p.goto(base + "/?view=create");
          await p
            .getByRole("status")
            .filter({ hasText: "That address is taken" })
            .waitFor();
          await p
            .getByRole("button", {
              name: "primary-online.jktl.com.ng",
              exact: true,
            })
            .click();
          await p
            .getByRole("status")
            .filter({ hasText: "This address is available" })
            .waitFor();
          await p
            .getByRole("button", { name: "Create website & start editing" })
            .click();
          await p.waitForFunction(() => window.lastRoute?.includes("?site="));
          if (
            (await p.evaluate(() => window.createdSite.subdomain)) !==
            "primary-online"
          )
            throw Error("Suggestion selection lost");
          await p.goto(base + "/?view=edit");
          await p.getByLabel("Publish website", { exact: false }).check();
          await p
            .getByRole("button", {
              name: "Save & publish website",
              exact: true,
            })
            .click();
          await p.waitForFunction(
            () => window.lastRoute === "/business/website",
          );
          if (await p.evaluate(() => Boolean(window.primaryWasUpdated)))
            throw Error("Primary store was overwritten");
          const save = await p.evaluate(() => window.savedSites[0]);
          if (
            save.id !== "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" ||
            !save.published
          )
            throw Error("Wrong website saved");
          if (errors.length) throw Error(errors.join(";"));
          console.log(
            JSON.stringify({
              width,
              dark,
              list: "all links and upgrade visible",
              address: "suggestion and creation passed",
              publish: "isolated and returned to list",
              errors,
            }),
          );
          await p.close();
        }
        console.log("Screenshots:", dir);
      } catch (e) {
        console.error(e);
        process.exitCode = 1;
      } finally {
        if (b) await b.close();
        server.close();
      }
    });
  },
);
