/** Real workspace components and CSS. Auth/navigation and action transports are isolated fixtures. */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), repo = fileURLToPath(new URL('..', import.meta.url));
const dir = '/tmp/jktl-admin-workspace-ui';
mkdirSync(dir,{recursive:true});
const write=(name,value)=>writeFileSync(path.join(dir,name),value);
write('loader.cjs',`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
write('style.cjs',`module.exports=function(){};module.exports.pitch=function(remaining){return 'const m=require('+JSON.stringify('!!'+remaining)+');const css=m.default||m;const el=document.createElement("style");el.textContent=css.toString();document.head.appendChild(el);module.exports=css.locals||{};';};`);
write('navigation.ts',`import {useSyncExternalStore} from 'react';export function unstable_rethrow(){};export function usePathname(){return useSyncExternalStore(listener=>{window.addEventListener('popstate',listener);return()=>window.removeEventListener('popstate',listener)},()=>location.pathname,()=>'/admin/custom-projects')};export function useRouter(){return{refresh(){window.adminFixture.refreshes++}}};`);
write('link.tsx',`import React from 'react';export default function Link({href,prefetch,children,...props}){return <a {...props} href={href} data-prefetch={String(prefetch)} onClick={event=>{props.onClick?.(event);if(!href.startsWith('/'))return;event.preventDefault();history.pushState({},'',href);window.dispatchEvent(new PopStateEvent('popstate'));}}>{children}</a>;}`);
write('image.tsx',`import React from 'react';export default function Image({fill,priority,sizes,...props}){return <img {...props}/>};`);
const actionNames=['openTeamBusinessAction','changeCustomServiceAction','configureCustomCmsAction','replyCustomRequestAction','saveCustomProjectAction','saveCustomServiceAction','sendCustomInviteAction','setCustomReadyAction','completeProjectPaymentReviewAction','configureProjectPortalAction','createProjectInvoiceAction','projectInvoiceStateAction','reconcileProjectPaymentAction','revokeProjectKeyAction','rotateProjectKeyAction','loadRecordCorrectionAction','saveRecordCorrectionAction','managedCmsConfigAction','saveManagedCmsConfigAction'];
write('actions.ts', actionNames.map(name=>`export async function ${name}(...args){window.adminFixture.calls.push({name:'${name}',args});return{ok:true};}`).join('\n')+`
export async function customAdminAction(){return{ok:true,data:window.adminFixture.data}}
export async function createCustomClientAction(input){window.adminFixture.calls.push({name:'createCustomClientAction',input});window.adminFixture.data={...window.adminFixture.data,clients:[{name:input.name,email:input.email,organization_id:'mock-new-client',pilot_ready:false}]};return{ok:true}}
export async function customPortalOverviewAction(){return{summary:{projects:1},invoices:[],payments:[],owners:[],keys:[],tickets:[]}}
`);
write('entry.tsx',`
import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{OperationsFrame}from'@/components/admin/operations-frame';import{CustomAdmin}from'@/components/custom/admin';
import{SectionNav}from'@/components/admin/section-nav';import{WorkspaceUnavailable}from'@/components/admin/workspace-unavailable';
import{navFor,ROLE_LABEL,adminLandingPath}from'@/lib/admin-permissions';
const empty={clients:[],projects:[],services:[],invoices:[],requests:[],audit:[]};
const populated={...empty,clients:[{organization_id:'mock-client',name:'Example client',email:'client@example.test',pilot_ready:false}],projects:[{id:'mock-project',organization_id:'mock-client',name:'Example website',status:'LIVE',website_url:'https://example.test',revision:1,description:'Example project scope'}]};
window.adminFixture={calls:[],refreshes:0,data:empty};
function App(){const[role,setRole]=useState('owner'),[mode,setMode]=useState('empty');return <OperationsFrame role={ROLE_LABEL[role]} name="Example Team Member" nav={navFor(role)} homeHref={adminLandingPath(role)} logout={async()=>{}}>
<div className="mb-4 flex flex-wrap gap-2"><label>Fixture role <select aria-label="Fixture role" value={role} onChange={e=>setRole(e.target.value)}>{['owner','support','writer','growth_gaming_lead','analyst','executive_associate'].map(r=><option key={r}>{r}</option>)}</select></label><button onClick={()=>{window.adminFixture.data=empty;setMode('empty')}}>Empty fixture</button><button onClick={()=>{window.adminFixture.data=populated;setMode('populated')}}>Populated fixture</button><button onClick={()=>setMode('unavailable')}>Unavailable fixture</button></div>
<SectionNav label="Fixture email sections" items={[{label:'Compose',href:'/admin/emails'},{label:'Renewals',href:'/admin/emails/renewals'},{label:'Branding',href:'/admin/emails/branding'}]}/>
<div className="mt-4">{mode==='unavailable'?<WorkspaceUnavailable title="Fixture service unavailable" detail="Fixture service needs a configuration check."/>:<CustomAdmin key={mode} initial={mode==='empty'?empty:populated}/>}</div></OperationsFrame>}
createRoot(document.getElementById('root')).render(<App/>);
`);
const webpack=require('next/dist/compiled/webpack/webpack').webpack;
const compiler=webpack({mode:'production',target:'web',entry:path.join(dir,'entry.tsx'),output:{path:dir,filename:'app.js'},
 resolve:{extensions:['.tsx','.ts','.jsx','.js'],modules:[path.join(repo,'node_modules'),'node_modules'],alias:{'next/link$':path.join(dir,'link.tsx'),'next/image$':path.join(dir,'image.tsx'),'next/navigation$':path.join(dir,'navigation.ts'),'@':path.join(repo,'src'),react:path.dirname(require.resolve('react/package.json')),'react-dom':path.dirname(require.resolve('react-dom/package.json'))}},
 module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(dir,'loader.cjs')},{test:/\.css$/,use:[path.join(dir,'style.cjs'),{loader:require.resolve('next/dist/build/webpack/loaders/css-loader/src/index.js'),options:{postcss:async()=>({postcss:require('postcss')}),esModule:false,modules:{getLocalIdent:require('next/dist/build/webpack/config/blocks/css/loaders/getCssModuleLocalIdent').getCssModuleLocalIdent}}}]}]},
 plugins:[{apply(compiler){compiler.hooks.compilation.tap('FixtureCssTrace',compilation=>{webpack.NormalModule.getCompilationHooks(compilation).loader.tap('FixtureCssTrace',context=>{context.currentTraceSpan=require('next/dist/trace').trace('admin-workspace-fixture')})})}},new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('production')}),new webpack.NormalModuleReplacementPlugin(/@\/lib\/actions\//,resource=>{resource.request=path.join(dir,'actions.ts')})],optimization:{minimize:false},devtool:false});
await new Promise((resolve,reject)=>compiler.run((error,stats)=>{if(error)return reject(error);if(stats.hasErrors())return reject(Error(stats.toString({all:false,errors:true})));compiler.close(e=>e?reject(e):resolve())}));
let css='';for(const folder of ['.next/static/css','.next/static/chunks'])try{for(const name of readdirSync(path.join(repo,folder)))if(name.endsWith('.css'))css+=readFileSync(path.join(repo,folder,name),'utf8')}catch{}
write('styles.css',css);
write('index.html','<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/jktl-logo.png'){res.setHeader('Content-Type','image/png');res.end(readFileSync(path.join(repo,'public/jktl-logo.png')));return;}
 const name=pathname==='/app.js'?'app.js':pathname==='/styles.css'?'styles.css':'index.html';res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(readFileSync(path.join(dir,name)));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const{chromium}=require('playwright');
let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const width of [1440,390,320])for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[],posts=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.method()==='POST')posts.push(request.url())});
  await page.goto('http://127.0.0.1:'+server.address().port+'/admin/custom-projects');await page.getByRole('heading',{name:'Custom projects',exact:true}).waitFor();
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);
  const tab=name=>page.getByRole('navigation',{name:'Custom project sections'}).getByRole('button',{name,exact:true});
  await tab('Projects').click();await page.getByRole('button',{name:'Add a client',exact:true}).click();assert.equal(await tab('Clients').getAttribute('aria-pressed'),'true');
  await tab('Services').click();await page.getByRole('button',{name:'Add a project',exact:true}).click();assert.equal(await tab('Projects').getAttribute('aria-pressed'),'true');
  for(const name of ['Invoices','Billing & Integration','Support','Audit']){await tab(name).click();assert.equal(await page.getByRole('navigation',{name:'Custom project sections'}).getByRole('button',{pressed:true}).count(),1);assert.ok(await page.locator('#workspace-content button:visible').count()>0)}
  await page.getByRole('button',{name:'Populated fixture',exact:true}).click();
  const client=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Example client'})}).last();
  assert.equal(await client.getAttribute('open'),null);await client.locator('summary').click();assert.notEqual(await client.getAttribute('open'),null);
  await tab('Projects').click();const project=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Example website'})}).last();assert.equal(await project.getAttribute('open'),null);await project.locator('summary').click();assert.equal(await project.getByLabel('Project name',{exact:true}).inputValue(),'Example website');
  await page.getByRole('button',{name:'Unavailable fixture',exact:true}).click();await page.getByRole('button',{name:'Try again',exact:true}).click();assert.equal(await page.evaluate(()=>window.adminFixture.refreshes),1);
  if(width<=760){await page.getByRole('button',{name:'Open navigation',exact:true}).click();assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');await page.waitForFunction(()=>document.getElementById('workspace-navigation').contains(document.activeElement));await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.getElementById('workspace-navigation').contains(document.activeElement)),true);await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Open navigation',exact:true}).getAttribute('aria-expanded'),'false');assert.equal(await page.getByRole('button',{name:'Open navigation',exact:true}).evaluate(node=>node===document.activeElement),true);await page.getByRole('button',{name:'Open navigation',exact:true}).click()}
  const nav=page.getByRole('navigation',{name:'Team navigation',exact:true}),search=page.getByRole('textbox',{name:'Find a workspace page'});
  await search.fill('renewals');assert.equal(await nav.getByRole('link').count(),1);await nav.getByRole('link',{name:'Renewals & reminders',exact:true}).click();
  assert.equal(await page.getByRole('navigation',{name:'Fixture email sections'}).getByRole('link',{name:'Renewals',exact:true}).getAttribute('aria-current'),'page');
  if(width<=760)await page.getByRole('button',{name:'Open navigation',exact:true}).click();
  assert.equal(await nav.getByRole('link',{name:'Renewals & reminders',exact:true}).getAttribute('aria-current'),'page');
  await search.fill('nothing-matches');await page.getByRole('button',{name:'Clear search',exact:true}).click();assert.equal(await search.inputValue(),'');assert.equal(await nav.locator('a[href="/admin/clients"]').count(),0);
  for(const role of ['support','writer','growth_gaming_lead','analyst','executive_associate']){
   if(width<=760)await page.getByRole('button',{name:'Close navigation',exact:true}).click();
   await page.getByRole('combobox',{name:'Fixture role'}).selectOption(role);
   if(width<=760)await page.getByRole('button',{name:'Open navigation',exact:true}).click();
   assert.equal(await nav.locator('a[href="/admin/custom-projects"],a[href="/admin/emails/renewals"],a[href="/admin/team/payments"]').count(),0);
  }
  if(width<=760)await page.getByRole('button',{name:'Close navigation',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);assert.deepEqual(await page.evaluate(()=>window.adminFixture.calls),[]);
  await page.getByRole('combobox',{name:'Fixture role'}).selectOption('owner');await page.getByRole('button',{name:'Populated fixture',exact:true}).click();
  await page.screenshot({path:'/tmp/jktl-admin-workspace-'+width+'-'+theme+'.png',fullPage:true});
  await page.close();console.log('Passed '+width+'px '+theme+' navigation, permissions, empty states, record expansion and recovery checks.');
 }
}catch(error){if(browser)for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'/tmp/admin-workspace-failure.png',fullPage:true});throw error;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
