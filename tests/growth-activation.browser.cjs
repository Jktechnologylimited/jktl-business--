// Render actual onboarding/checklist/growth components with isolated API fixtures.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'jktl-growth-'));
const file=(n,s)=>{const p=path.join(dir,n);fs.writeFileSync(p,s);return p};
const loader=file('ts.cjs',`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText`);
const profile={businessType:'general',displayName:'Example business',phone:'',city:'',state:'',email:'owner@example.test',address:'',countryCode:'NG'};
const store=file('store.js',`const data={mode:'live',data:{profile:${JSON.stringify(profile)}},pendingSignup:null,addService:()=>{},createLiveAccount:async()=>({ok:true}),completeOnboarding:(type,name,profile)=>{window.completed={type,name,profile}}};export const useBusinessStore=selector=>selector(data);`);
const actions=file('actions.js',`export async function updateBusinessProfileAction(details){window.savedDetails=details;return new URLSearchParams(location.search).has('fail')?{ok:false,error:'fixture failure'}:{ok:true,data:details}}export async function listBusinessWebsitesAction(){const state=new URLSearchParams(location.search).get('state');return {canManage:true,sites:state==='choose'?[]:[{id:'extra',kind:state==='custom'?'custom':'template',published:state==='published',editUrl:'/business/website/template?site=extra',url:'https://example.jktl.com.ng',name:'Example website'}]}}`);
const nav=file('navigation.js',`export const useRouter=()=>({push:to=>{window.destination=to}});export const useSearchParams=()=>new URLSearchParams(location.search);`);
const link=file('link.js',`import React from 'react';export default function Link(props){return React.createElement('a',props)}`);
const lang=file('lang.js',`import React from 'react';export function T({children}){return React.createElement(React.Fragment,null,children)}`);
const services=file('services.js',`import React from 'react';export function ServiceForm({onCancel}){return React.createElement('button',{onClick:onCancel},'Skip service')}`);
const mark=file('mark.js',`import React from 'react';export function JktlMark(){return React.createElement('span',null,'JKTL')}`);
const entry=file('entry.js',`import React from 'react';import{createRoot}from'react-dom/client';import Onboarding from ${JSON.stringify(path.join(root,'src/app/onboarding/page.tsx'))};import{ActivationChecklist}from ${JSON.stringify(path.join(root,'src/components/websites/activation-checklist.tsx'))};import{GrowthOverview}from ${JSON.stringify(path.join(root,'src/components/admin/investor/GrowthOverview.tsx'))};const report={accounts:{available:true,data:{total:21,custom:11,started:2,published:2}},subscriptions:{available:true,data:{verified:1}},activation:{available:false},receivables:{available:true,data:{outstanding:100000,overdue:50000,invoices:2,underReview:0}},acquisition:{available:true,data:{sources:[{source:'Example distribution account',programme:'partner',registered:5,published:3,paying:1,retained:100000}]}}};let kind=new URLSearchParams(location.search).get('view');createRoot(document.getElementById('app')).render(React.createElement(kind==='checklist'?ActivationChecklist:kind==='growth'?()=>React.createElement(GrowthOverview,{report}):Onboarding));`);
require('next/dist/compiled/webpack/webpack').webpack({mode:'development',entry,output:{path:dir,filename:'bundle.js'},devtool:false,module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:loader}]},resolve:{extensions:['.tsx','.ts','.js','.json'],modules:[path.join(root,'node_modules')],alias:{'@/lib/store':store,'@/lib/actions/business-actions':actions,'@/lib/actions/multiple-website-actions':actions,'next/navigation':nav,'next/link':link,'@/components/i18n/LanguageProvider':lang,'@/components/services/service-form':services,'@/components/app/logo':mark,'@':path.join(root,'src')}}},(error,stats)=>{
 if(error||stats.hasErrors()){console.error(error||stats.toString({all:false,errors:true}));process.exitCode=1;return}
 let css='';for(const name of fs.readdirSync(path.join(root,'.next/static/chunks')))if(name.endsWith('.css'))css+=fs.readFileSync(path.join(root,'.next/static/chunks',name),'utf8');
 const server=http.createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(dir,'bundle.js')))}else {res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body><main style="max-width:1100px;margin:auto;padding:16px"><div id="app"></div></main><script src="/bundle.js"></script>`)}});
 server.listen(0,'127.0.0.1',async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const width of [1440,390,320]){
  const p=await browser.newPage({viewport:{width,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  for(const state of ['choose','draft','published','custom']){
   await p.goto(`${base}/?view=checklist&state=${state}`);await p.getByRole('heading',{level:2}).waitFor();
   const label={choose:'Choose a free template',draft:'Continue my draft',published:'Update my website',custom:'Manage my Custom project'}[state];await p.getByRole('link',{name:label,exact:false}).waitFor();
   if(state==='draft')assert.equal(await p.getByRole('link',{name:/Continue my draft/}).getAttribute('href'),'/business/website/template?site=extra');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`checklist ${state} ${width} overflow`);
  }
  await p.goto(`${base}/?view=growth`);await p.getByRole('heading',{name:'Growth & revenue overview'}).waitFor();
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`growth ${width} overflow`);
  for(const fail of [false,true]){
   await p.goto(`${base}/?template=law-firm${fail?'&fail=1':''}`);
   await p.getByRole('button',{name:'Continue',exact:true}).click();await p.getByLabel('Business name',{exact:true}).waitFor();
   await p.getByLabel('Business name',{exact:true}).fill('My legal practice');await p.getByLabel('Phone',{exact:true}).fill('+2348012345678');await p.getByLabel('City',{exact:true}).fill('Port Harcourt');await p.getByLabel('State',{exact:true}).fill('Rivers');
   await p.getByRole('button',{name:'Continue',exact:true}).click();await p.getByRole('button',{name:'Skip service'}).click();
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`onboarding ${width} overflow`);
   await p.getByRole('button',{name:'Customize my website',exact:true}).click();
   if(fail){await p.getByRole('alert').waitFor();assert.equal(await p.evaluate(()=>window.destination),undefined);assert.equal(await p.evaluate(()=>window.completed),undefined)}else{
    await p.waitForFunction(()=>window.destination);const saved=await p.evaluate(()=>window.completed.profile);
    assert.equal(saved.phone,'+2348012345678');assert.equal(saved.city,'Port Harcourt');assert.equal(saved.state,'Rivers');assert.match(await p.evaluate(()=>window.destination),/template=law-firm/);
   }
  }
  assert.deepEqual(errors,[]);await p.screenshot({path:`/tmp/jktl-growth-onboarding-${width}.png`,fullPage:true});await p.close();console.log(`Passed ${width}px: four website states, growth overview, onboarding persistence and failed-save recovery.`);
 }
 }catch(e){console.error(e);process.exitCode=1}finally{await browser?.close();server.close();fs.rmSync(dir,{recursive:true,force:true})}});
});
