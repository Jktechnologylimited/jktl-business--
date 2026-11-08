// Browser fixtures only: no real partner session, email, publication or purchase.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  http = require("node:http");
const root = path.resolve(__dirname, ".."),
  ts = require("typescript"),
  { chromium } = require("playwright");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jktl-partner-studio-"));
function file(name, body) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, body);
  return p;
}
const loader = file(
  "loader.cjs",
  `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=function(s){return ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText}`,
);
const link = file(
  "link.js",
  `import React from'react';export default function Link({children,...props}){return React.createElement('a',props,children)}`,
);
const image = file(
  "image.js",
  `import React from'react';export default function Image({fill,priority,unoptimized,...props}){return React.createElement('img',props)}`,
);
const router = file(
  "router.js",
  `export function usePathname(){return '/partners/workspace'}`,
);
const theme = file("theme.js", `export function ThemeControl(){return null}`);
const fields = file(
  "fields.js",
  `import React from'react';export function WebsiteFields({value,onChange}){return React.createElement('label',null,'Website headline',React.createElement('input',{'aria-label':'Website headline',value:value.headline,onChange:e=>onChange({...value,headline:e.target.value}),style:{width:'100%',border:'1px solid #aaa',padding:12,marginTop:10}}))}`,
);
const preview = file(
  "preview.js",
  `import React from'react';export function WebsiteDraftPreview(){return React.createElement('p',null,'Website preview fixture')}`,
);
const services = file(
  "services.js",
  `import React from'react';export function ClientServices({canPurchaseDomains}){return React.createElement('p',null,'Authorized services; domain checkout '+(canPurchaseDomains?'enabled':'requires permission'))}`,
);
const actions = file(
  "actions.js",
  `import{templateDraft}from${JSON.stringify(path.join(root, "src/lib/website-templates.ts"))};
const draft=templateDraft('law-firm','Draft Client');const docs={draft:structuredClone(draft),accepted:templateDraft('law-firm','Accepted Client')};let grants=['MANAGE_WEBSITE_CONTENT'];window.studioCalls=[];
export async function partnerWorkspaceDataAction(id){const claimed=id==='accepted';return {workspace:{id,partner_id:'p',organization_id:claimed?'org':null,business_name:claimed?'Accepted Client':'Draft Client',contact_name:'Test Owner',contact_email:'owner@example.test',template_id:'law-firm',document:docs[id],revision:1,checklist:window.testChecklist||{}},registry:[{slug:'website-builder',partner_mode:'SELF_SERVICE',partner_actions:['CONFIGURE']}],website:claimed?{website_template_id:'law-firm',website_document:docs[id],website_revision:1,published:window.testPublished||false,subdomain:'accepted-client'}:null,scopes:claimed?grants:[]}}
export async function savePartnerWebsiteAction(input){window.studioCalls.push(input);docs[input.id]=input.document;if(input.publish)window.testPublished=true;return{ok:true}}
export async function inviteWorkspaceOwnerAction(id){window.testInvited=id;return{url:'https://business.jktl.com.ng/business/distribution?invite=FIXTURE-ONLY'}}
export async function setPartnerChecklistAction(id,task,value){window.testChecklist={...window.testChecklist,[task]:value}}
window.grantPublish=()=>{grants=['MANAGE_WEBSITE_CONTENT','PUBLISH_WEBSITE','VIEW_ALLOWED_SERVICES','REQUEST_SERVICE_CHANGES','PURCHASE_DOMAINS']};`,
);
const entry = file(
  "entry.js",
  `import React from'react';import{createRoot}from'react-dom/client';import{PartnerShell}from${JSON.stringify(path.join(root, "src/components/partners/partner-shell.tsx"))};import{PartnerWorkspace}from${JSON.stringify(path.join(root, "src/components/distribution/partner-workspace.tsx"))};createRoot(document.getElementById('app')).render(React.createElement(PartnerShell,{name:'Test Partner',logout:async()=>{}},React.createElement('div',{className:'space-y-6'},React.createElement('h1',{className:'text-3xl font-semibold'},'Clients & websites'),React.createElement(PartnerWorkspace,{clients:[{id:'draft',name:'Draft Client',claimed:false},{id:'accepted',name:'Accepted Client',claimed:true}],initialId:'draft'}))));`,
);
const aliases = {
  "next/link": link,
  "next/image": image,
  "next/navigation": router,
  "@/components/settings/theme-control": theme,
  "@/components/support/website-fields": fields,
  "@/components/support/website-draft-preview": preview,
  "@/components/distribution/client-services": services,
  "@/lib/actions/partner-workspace-actions": actions,
  "@": path.join(root, "src"),
};
// Relative import in PartnerWorkspace is resolved explicitly too.
aliases[path.join(root, "src/components/distribution/client-services")] =
  services;
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
      alias: aliases,
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
      if (req.url === "/bundle.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(fs.readFileSync(path.join(dir, "bundle.js")));
        return;
      }
      const asset = path.resolve(
        root,
        "public",
        "." + new URL(req.url, "http://localhost").pathname,
      );
      if (
        asset.startsWith(path.join(root, "public") + path.sep) &&
        fs.existsSync(asset) &&
        fs.statSync(asset).isFile()
      ) {
        res.setHeader(
          "Content-Type",
          asset.endsWith(".svg")
            ? "image/svg+xml"
            : asset.endsWith(".png")
              ? "image/png"
              : "image/jpeg",
        );
        res.end(fs.readFileSync(asset));
        return;
      }
      res.setHeader("Content-Type", "text/html;charset=utf-8");
      res.end(
        '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
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
          await p.goto("http://127.0.0.1:" + server.address().port);
          await p.getByLabel("Website headline").waitFor();
          if (
            !(await p
              .getByRole("button", { name: "Publish website", exact: true })
              .isDisabled())
          )
            throw Error("Draft could publish");
          await p
            .getByLabel("Website headline")
            .fill("Keep this unsaved headline");
          await p
            .getByRole("button", { name: "Client handover", exact: true })
            .click();
          await p
            .getByLabel("Business details and contact information reviewed")
            .check();
          await p
            .getByRole("button", { name: "Website studio", exact: true })
            .click();
          if (
            (await p.getByLabel("Website headline").inputValue()) !==
            "Keep this unsaved headline"
          )
            throw Error("Checklist discarded edits");
          await p
            .getByRole("button", { name: "Save website", exact: true })
            .click();
          await p
            .getByRole("status")
            .filter({ hasText: "Website draft saved." })
            .waitFor();
          await p
            .getByRole("button", { name: "Owner & access", exact: true })
            .click();
          await p
            .getByRole("button", { name: "Create owner invitation" })
            .click();
          await p.getByLabel("Private owner invitation").waitFor();
          if ((await p.evaluate(() => window.testInvited)) !== "draft")
            throw Error("Wrong owner invitation");
          await p.getByLabel("Choose a client").selectOption("accepted");
          await p
            .getByRole("button", { name: "Website studio", exact: true })
            .click();
          await p.getByLabel("Website headline").waitFor();
          if (
            !(await p
              .getByRole("button", { name: "Publish website", exact: true })
              .isDisabled())
          )
            throw Error("Publishing without grant");
          await p.evaluate(() => window.grantPublish());
          await p
            .getByRole("button", { name: "Owner & access", exact: true })
            .click();
          await p.getByRole("button", { name: "Refresh owner status" }).click();
          await p
            .getByRole("status")
            .filter({ hasText: "Client access refreshed." })
            .waitFor();
          await p
            .getByRole("button", { name: "Website studio", exact: true })
            .click();
          await p
            .getByRole("button", { name: "Publish website", exact: true })
            .click();
          await p.getByRole("link", { name: "View live site" }).waitFor();
          const calls = await p.evaluate(() =>
            window.studioCalls.map((c) => ({ id: c.id, publish: c.publish })),
          );
          if (
            calls.length !== 2 ||
            calls[1].id !== "accepted" ||
            !calls[1].publish
          )
            throw Error("Wrong publish target");
          await p
            .getByRole("button", { name: "Services & payments", exact: true })
            .click();
          await p
            .getByText("Authorized services; domain checkout enabled")
            .waitFor();
          if (width < 1024) {
            await p.getByRole("button", { name: "Open navigation" }).click();
            await p.getByRole("button", { name: "Close navigation" }).click();
          }
          const size = await p.evaluate(() => ({
            width: innerWidth,
            scroll: document.documentElement.scrollWidth,
          }));
          if (size.scroll > width || errors.length)
            throw Error(JSON.stringify({ size, errors }));
          await p.evaluate(() => window.scrollTo(0, 0));
          await p.screenshot({
            path: path.join(dir, `studio-${width}-${dark}.png`),
            fullPage: true,
          });
          console.log(JSON.stringify({ width, dark, calls, errors, ...size }));
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
