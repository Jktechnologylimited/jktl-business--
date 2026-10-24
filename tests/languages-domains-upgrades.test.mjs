import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import ts from 'typescript';
import * as languages from '../src/lib/languages.ts';
import * as catalogue from '../src/lib/website-templates.ts';
function load(file,dependencies){const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const mod={exports:{}};new Function('require','module','exports',code)(name=>{if(!(name in dependencies))throw new Error(`Unexpected dependency ${name}`);return dependencies[name]},mod,mod.exports);return mod.exports;}
test('Hausa, Igbo and Yoruba translate real interface copy with safe English fallback',()=>{
 assert.deepEqual(languages.supportedLanguages,['en','ha','ig','yo']);
 for(const locale of ['ha','ig','yo']){
  for(const message of ['Start for free','Log in','Customers','Pricing','Full name','Your own domain.','Choose your name'])assert.notEqual(languages.translate(locale,message),message,`${locale}: ${message}`);
  assert.equal(languages.translate(locale,'A business name entered by a customer'),'A business name entered by a customer');
  assert.equal(languages.translate(locale,'  Start for free  '),languages.translate(locale,'Start for free'));
  assert.ok(languages.translate(locale,'Start for free →').endsWith('→'));
 }
 for(const value of ['fr','<script>','javascript:ha',null,{},'HA'])assert.equal(languages.isLanguage(value),false);
});
test('upgrade excursion preserves selected design and per-tenant draft without publishing or reselecting',()=>{
 const selection=load('../src/lib/template-selection.ts',{'./website-templates':catalogue});const data=new Map();const previous=globalThis.window;
 globalThis.window={sessionStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}};
 try{
 const document=catalogue.templateDraft('school','School Owner');selection.rememberTemplate('school');selection.rememberTemplateSessionDraft('org-a','school',4,document);
 assert.equal(selection.pendingTemplate(),'school');assert.deepEqual(selection.readTemplateSessionDraft('org-a','school',4),document);
 assert.equal(selection.readTemplateSessionDraft('org-b','school',4),null);assert.equal(selection.readTemplateSessionDraft('org-a','school',5),null);assert.equal(selection.readTemplateSessionDraft('org-a','law-firm',4),null);
 selection.rememberTemplate('unknown');assert.equal(selection.pendingTemplate(),'school');
 data.set('jktl.website-draft:org-a:school',JSON.stringify({revision:4,updatedAt:Date.now()-25*60*60*1000,document}));assert.equal(selection.readTemplateSessionDraft('org-a','school',4),null);
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
const paired=existsSync(new URL('../../jktl-main/lib/domain-catalogue.ts',import.meta.url));
test('domain reseller input and configurable retail prices never invent availability or prices',{skip:!paired},async()=>{
 const domains=await import('../../jktl-main/lib/domain-catalogue.ts');
 assert.equal(domains.normaliseRequestedDomain('  My-Brand.COM.NG ','.com.ng'),'my-brand.com.ng');assert.equal(domains.normaliseRequestedDomain('mybrand','.name.ng'),'mybrand.name.ng');
 for(const [label,extension]of [['https://example.com','.com'],['a.b','.ng'],['-bad','.ng'],['a'.repeat(64),'.ng'],['x','.unknown'],['person@example','.com'],['x/y','.ng']])assert.throws(()=>domains.normaliseRequestedDomain(label,extension));
 assert.deepEqual(domains.getRetailDomainPrices('{}'),{});assert.deepEqual(domains.getRetailDomainPrices('bad json'),{});
 const prices=domains.getRetailDomainPrices(JSON.stringify({'.ng':{currency:'NGN',registrationKobo:100000,renewalKobo:120000},'.com':{currency:'USD',registrationKobo:100,renewalKobo:100},'.com.ng':{currency:'NGN',registrationKobo:-1,renewalKobo:100}}));assert.deepEqual(Object.keys(prices),['.ng']);assert.equal(prices['.ng'].renewalKobo,120000);
 const request=domains.parseDomainRequest({name:'Owner',email:'OWNER@example.com',phone:'',label:'mybrand',extension:'.com.ng',operation:'registration',years:1});assert.equal(request.domain,'mybrand.com.ng');assert.equal(request.email,'owner@example.com');
 for(const override of [{email:'bad'},{operation:'automatic-charge'},{years:10},{name:''},{label:'http://fake'}])assert.throws(()=>domains.parseDomainRequest({...request,label:'mybrand',...override}));
});
test('every Product, Solutions and Resources item has a public page instead of a shared anchor',{skip:!paired},async()=>{
 const {navigation}=await import('../../jktl-main/data/navigation.ts');const {featurePages}=await import('../../jktl-main/data/feature-pages.ts');
 const existing=new Set(['/templates','/landing-pages','/products/domains','/products/business-email','/products/business-tools','/products/add-ons','/products/custom-websites','/industries','/about','/affiliates','/contact','/pricing','/how-it-works']);
 const pages=new Set(featurePages.map(page=>`/${page.section}/${page.slug}`));const destinations=[];
 for(const menu of Object.values(navigation))for(const item of [...menu.groups.flatMap(group=>group.items),...menu.aside.items]){assert.ok(!item.href.includes('#'),item.title);assert.ok(item.href.startsWith('/'),item.title);assert.ok(existing.has(item.href)||pages.has(item.href),item.href);destinations.push(item.href);}
 assert.equal(new Set(destinations).size,destinations.length,'Each menu item has its own destination');
});
test('domain request endpoint validates origin/body and confirms request only after storage',{skip:!paired},async()=>{
 const domains=await import('../../jktl-main/lib/domain-catalogue.ts');const next=await import('next/server.js');let saved;let available=true;
 const route=load('../../jktl-main/app/api/domains/request/route.ts',{'next/server':next,'@/lib/domain-catalogue':domains,'@/lib/inquiries':{saveInquiry:async value=>{saved=value;return available;}}});
 const valid={name:'Owner',email:'owner@example.com',phone:'',label:'brand',extension:'.ng',operation:'registration',years:1};
 const req=(body,origin='https://jktl.com.ng')=>new next.NextRequest('https://jktl.com.ng/api/domains/request',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body),headers:{origin,'Content-Type':'application/json'}});
 assert.equal((await route.POST(req(valid,'https://other.example'))).status,403);assert.equal(saved,undefined);assert.equal((await route.POST(req({...valid,label:'bad/name'}))).status,400);assert.equal((await route.POST(req('x'.repeat(13000)))).status,413);
 available=false;assert.equal((await route.POST(req(valid))).status,503);available=true;const response=await route.POST(req(valid));assert.equal(response.status,201);assert.deepEqual(await response.json(),{ok:true,status:'requested',domain:'brand.ng',availability:'unconfirmed'});assert.equal(saved.source,'domain-reseller');assert.equal(saved.meta.provisioningStatus,'requested');assert.equal(saved.meta.provider,'Go54');
});
