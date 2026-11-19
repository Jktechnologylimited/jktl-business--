/** Real editor/Markdown/form components; isolated upload and save transports. */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const repo = fileURLToPath(new URL("..", import.meta.url));
const dir = "/tmp/jktl-growth-announcement-ui";
mkdirSync(dir, { recursive: true });
const write = (name, value) => writeFileSync(path.join(dir, name), value);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
write("navigation.ts", "export function unstable_rethrow(){}");
write("actions.ts", `
export async function saveGrowthDraftAction(data){window.editorFixture.saves.push(Object.fromEntries(data.entries()));}
export async function uploadEditorialImageAction(data){
 const file=data.get('file');window.editorFixture.uploads.push({name:file.name,alt:data.get('alt'),rights:data.get('rights'),category:data.get('growthCategory')});
 return{id:crypto.randomUUID(),url:'https://assets.example.test/upload-'+window.editorFixture.uploads.length+'.png',alt:data.get('alt')};
}
`);
write("entry.tsx", `
import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{GrowthContentEditor}from'@/components/admin/growth-content-editor';
window.editorFixture={uploads:[],saves:[]};
const saved={id:'fixture-draft',revision:2,slug:'saved-announcement',title:'Saved announcement',excerpt:'Existing summary for our community.',body:'## Saved heading\\n\\nExisting Markdown content.',cover_image:'https://assets.example.test/legacy.png',growth_category:'games'};
function App(){const[mode,setMode]=useState('games'),[available,setAvailable]=useState(true);return <main style={{maxWidth:1000,margin:'auto',padding:20}}><h1>Growth announcement fixture</h1><div className="flex flex-wrap gap-3 mb-5"><button onClick={()=>setMode('games')}>New game announcement</button><button onClick={()=>setMode('community')}>New community announcement</button><button onClick={()=>setMode('saved')}>Edit saved announcement</button><button onClick={()=>setAvailable(!available)}>Toggle storage</button></div><GrowthContentEditor key={mode+':'+available} category={mode==='community'?'community':'games'} row={mode==='saved'?saved:{}} media={[{id:'existing',url:'https://assets.example.test/existing.png',alt:'Approved community event image'}]} uploadsAvailable={available}/></main>}
createRoot(document.getElementById('root')).render(<App/>);
`);
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const compiler = webpack({
  mode: "production", target: "web", entry: path.join(dir, "entry.tsx"),
  output: { path: dir, filename: "app.js" },
  resolve: { extensions: [".tsx", ".ts", ".jsx", ".js"], modules: [path.join(repo, "node_modules"), "node_modules"], alias: {
    "@/lib/actions/growth-actions$": path.join(dir, "actions.ts"),
    "@/lib/actions/editorial-media-actions$": path.join(dir, "actions.ts"),
    "next/navigation$": path.join(dir, "navigation.ts"), "@": path.join(repo, "src"),
    react: path.dirname(require.resolve("react/package.json")), "react-dom": path.dirname(require.resolve("react-dom/package.json")),
  } },
  module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.join(dir, "loader.cjs") }] },
  plugins: [new webpack.DefinePlugin({ "process.env.NODE_ENV": JSON.stringify("production") })],
  optimization: { minimize: false }, devtool: false,
});
await new Promise((resolve, reject) => compiler.run((error, stats) => {
  if (error) return reject(error);
  if (stats.hasErrors()) return reject(Error(stats.toString({ all: false, errors: true })));
  compiler.close(error => error ? reject(error) : resolve());
}));
let css = "";
for (const folder of [".next/static/css", ".next/static/chunks"]) {
  try { for (const file of readdirSync(path.join(repo, folder))) if (file.endsWith(".css")) css += readFileSync(path.join(repo, folder, file), "utf8"); } catch {}
}
write("styles.css", css);
write("index.html", '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const file = path.resolve(dir, pathname === "/" ? "index.html" : pathname.slice(1));
  if (!file.startsWith(dir + path.sep)) { res.writeHead(404).end(); return; }
  try { const body = readFileSync(file); res.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html"); res.end(body); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lGQAAAAASUVORK5CYII=", "base64");
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.route("https://assets.example.test/**", route => route.fulfill({ status: 200, contentType: "image/png", body: png }));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const field = name => page.locator(`[name="${name}"]`);
    await field("slug").waitFor();
    for (const name of ["slug", "title", "excerpt", "body"]) {
      assert.equal(await field(name).inputValue(), "", "Examples must remain placeholders, not default content");
      assert.ok(await field(name).getAttribute("placeholder"));
    }
    assert.equal(await page.locator('input[name="coverImage"][type="url"]').count(), 0);
    assert.equal(await field("coverImage").getAttribute("type"), "hidden");
    await field("slug").fill("new-community-game-night"); await field("title").fill("Community game night");
    await field("excerpt").fill("Join our next game night and explore the new games.");
    await field("body").fill("## What is new\n\nWelcome to **game night**.\n\n- Play a game\n- Invite a friend\n\n<script>window.untrustedPreview=true</script>");
    async function upload(placement, alt) {
      await page.locator('input[type="file"]').setInputFiles({ name: "event.png", mimeType: "image/png", buffer: png });
      await page.getByLabel("Image description", { exact: true }).fill(alt);
      await page.getByLabel("Add uploaded image as", { exact: false }).selectOption(placement);
      await page.getByLabel("I have permission to publish this image.", { exact: true }).check();
      await page.getByRole("button", { name: "Upload image", exact: true }).click();
      await page.getByText("Image uploaded and added to your draft.", { exact: false }).waitFor();
    }
    await upload("cover", "Community game night poster");
    assert.match(await field("coverImage").inputValue(), /upload-1\.png$/);
    await page.getByRole("img", { name: "Community game night poster", exact: true }).first().waitFor();
    await field("body").focus(); await field("body").evaluate(el => el.setSelectionRange(el.value.length, el.value.length));
    await upload("body", "Players sharing their scores");
    assert.match(await field("body").inputValue(), /!\[Players sharing their scores\]\(https:\/\/assets.example.test\/upload-2.png\)/);
    await page.getByRole("button", { name: "Preview content", exact: true }).click();
    const preview = page.getByRole("region", { name: "Unsaved content preview" });
    await preview.getByRole("heading", { name: "What is new", exact: true }).waitFor();
    assert.equal(await preview.locator("strong").innerText(), "game night");
    assert.equal(await preview.getByRole("listitem").count(), 2);
    await preview.getByRole("img", { name: "Players sharing their scores", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.untrustedPreview), undefined);
    await page.getByRole("button", { name: "Save unpublished draft", exact: true }).click();
    await page.getByText("Unpublished draft saved.", { exact: false }).waitFor();
    let saved = await page.evaluate(() => window.editorFixture.saves.at(-1));
    assert.match(saved.coverImage, /upload-1\.png$/); assert.ok(saved.body.includes("![Players sharing their scores]"));
    assert.equal(saved.slug, "new-community-game-night");
    const uploads = await page.evaluate(() => window.editorFixture.uploads);
    assert.equal(uploads.length, 2); assert.ok(uploads.every(upload => upload.rights === "on" && upload.category === "games"));
    await page.getByRole("button", { name: "Edit saved announcement", exact: true }).click();
    assert.equal(await field("coverImage").inputValue(), "https://assets.example.test/legacy.png");
    await page.getByRole("button", { name: "Save unpublished draft", exact: true }).click();
    await page.getByText("Unpublished draft saved.", { exact: false }).waitFor();
    saved = await page.evaluate(() => window.editorFixture.saves.at(-1)); assert.equal(saved.coverImage, "https://assets.example.test/legacy.png");
    await page.getByRole("button", { name: "Remove cover image", exact: true }).click();
    assert.equal(await field("coverImage").inputValue(), "");
    await page.getByRole("button", { name: "Save unpublished draft", exact: true }).click();
    await page.waitForFunction(() => window.editorFixture.saves.at(-1).coverImage === "");
    await page.getByRole("button", { name: "Toggle storage", exact: true }).click();
    await page.getByText("Image uploads are not configured yet.", { exact: false }).waitFor();
    assert.equal(await page.locator('input[type="file"]').count(), 0);
    assert.equal(await page.getByText("Cover image HTTPS URL", { exact: false }).count(), 0);
    assert.equal(await field("coverImage").inputValue(), "https://assets.example.test/legacy.png");
    await page.getByRole("button", { name: "Toggle storage", exact: true }).click();
    await page.getByRole("button", { name: "New community announcement", exact: true }).click();
    assert.equal(await field("category").inputValue(), "community");
    assert.equal(await field("body").inputValue(), "");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `/tmp/growth-announcement-${width}.png`, fullPage: true });
    await page.close();
    console.log(`Passed ${width}px upload/inline Markdown/preview/save/cover retention/removal/unconfigured-storage checks.`);
  }
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
