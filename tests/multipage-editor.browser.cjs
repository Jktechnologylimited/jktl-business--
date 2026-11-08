// Actual editor iframe/renderer integration; no auth, database or real save calls.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  http = require("node:http");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, ".."),
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jktl-multipage-editor-"));
const file = (n, s) => {
  let p = path.join(dir, n);
  fs.writeFileSync(p, s);
  return p;
};
const loader = file(
  "ts.cjs",
  `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText`,
);
const css = file(
  "css.cjs",
  `module.exports=function(source){const prefix=require('node:path').basename(this.resourcePath).replace(/[^a-z]/gi,'')+'_';const names=[...new Set([...source.matchAll(/\\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map(m=>m[1]))];const map=Object.fromEntries(names.map(n=>[n,prefix+n]));let text=source.replace(/\\.([a-zA-Z_][a-zA-Z0-9_-]*)/g,(m,n)=>'.'+map[n]);return 'const css='+JSON.stringify(text)+';if(typeof document!=="undefined"){const style=document.createElement("style");style.textContent=css;document.head.appendChild(style)};export default '+JSON.stringify(map);}`,
);
const entry = file(
  "entry.js",
  `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{TemplateCanvas}from${JSON.stringify(path.join(root, "src/components/templates/TemplateCanvas.tsx"))};import{getWebsiteTemplate,templateDraft}from${JSON.stringify(path.join(root, "src/lib/website-templates.ts"))};const id=new URLSearchParams(location.search).get('template')||'fashion';const t=getWebsiteTemplate(id);function Harness(){const[doc,setDoc]=useState(()=>templateDraft(id,'Draft Atelier'));return React.createElement(React.Fragment,null,React.createElement('label',null,'Draft headline',React.createElement('input',{value:doc.headline,onChange:e=>setDoc({...doc,headline:e.target.value})})),React.createElement(TemplateCanvas,{template:t,document:doc,contact:{}}))}createRoot(document.getElementById('app')).render(React.createElement(Harness));`,
);
require("next/dist/compiled/webpack/webpack").webpack(
  {
    mode: "development",
    entry,
    output: { path: dir, filename: "bundle.js" },
    module: {
      rules: [
        { test: /\.tsx?$/, exclude: /node_modules/, use: loader },
        { test: /\.module\.css$/, use: css },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js", ".json"],
      modules: [path.join(root, "node_modules"), "node_modules"],
      alias: { "@": path.join(root, "src") },
    },
    devtool: false,
  },
  (error, stats) => {
    if (error || stats.hasErrors()) {
      console.error(error || stats.toString({ all: false, errors: true }));
      process.exitCode = 1;
      return;
    }
    const server = http.createServer((req, res) => {
      const name = new URL(req.url, "http://fixture").pathname;
      if (name === "/bundle.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(fs.readFileSync(path.join(dir, "bundle.js")));
        return;
      }
      if (name.startsWith("/template-")) {
        const p = path.resolve(root, "public", "." + name);
        if (
          p.startsWith(path.join(root, "public") + path.sep) &&
          fs.existsSync(p)
        ) {
          res.setHeader(
            "Content-Type",
            p.endsWith(".svg") ? "image/svg+xml" : "image/jpeg",
          );
          res.end(fs.readFileSync(p));
          return;
        }
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader("Content-Type", "text/html;charset=utf-8");
      res.end(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="app"></div><script src="/bundle.js"></script></body></html>',
      );
    });
    server.listen(0, "127.0.0.1", async () => {
      let browser;
      try {
        browser = await chromium.launch({
          executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
          args: ["--no-sandbox"],
        });
        for (const id of ["fashion", "dressmaker-atelier", "jewellery-luxe"])
          for (const width of [1440, 390]) {
            const p = await browser.newPage({
                viewport: { width, height: 1000 },
              }),
              errors = [];
            p.on("pageerror", (e) => errors.push(e.message));
            const url =
              "http://127.0.0.1:" + server.address().port + "/?template=" + id;
            await p.goto(url);
            await p.getByLabel("Draft headline").fill("My unsaved headline");
            const frame = p.frameLocator("iframe");
            await frame
              .getByRole("heading", { level: 1, name: "My unsaved headline" })
              .waitFor();
            const toggle = frame.getByRole("button", {
              name: /^(Menu|Open menu)/,
            });
            if (await toggle.isVisible()) await toggle.click();
            await frame
              .locator(
                'header a[href$="/' +
                  (id === "dressmaker-atelier" ? "atelier" : "about") +
                  '"]:visible',
              )
              .click();
            await frame
              .getByRole("heading", {
                level: 1,
                name: id === "dressmaker-atelier" ? "Our atelier" : "About us",
              })
              .waitFor();
            if (
              (await p.getByLabel("Draft headline").inputValue()) !==
              "My unsaved headline"
            )
              throw Error("Draft reset on page change");
            await frame.locator('footer a[href$="/contact"]').first().click();
            await frame.getByRole("heading", { level: 1 }).waitFor();
            await frame
              .locator('header a[href="/template-canvas/' + id + '"]')
              .first()
              .click();
            await frame
              .getByRole("heading", { level: 1, name: "My unsaved headline" })
              .waitFor();
            if (p.url() !== url) throw Error("Editor left its draft route");
            if (p.frames()[1].url() !== "about:srcdoc")
              throw Error("Preview iframe navigated away and lost local state");
            if (errors.length) throw Error(errors.join("\n"));
            console.log(
              JSON.stringify({
                id,
                width,
                iframeNavigation: true,
                unsavedDraftRetained: true,
              }),
            );
            await p.close();
          }
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
