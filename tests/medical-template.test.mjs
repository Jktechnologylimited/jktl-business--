import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from './fixtures/lifecycle-db.mjs';
import * as catalog from '../src/lib/website-templates.ts';
const css={__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
const beauty=load('src/components/templates/BeautyWebsite.tsx',{'@/lib/website-templates':catalog,'./BeautyWebsite.module.css':css});
const {MedicalWebsite}=load('src/components/templates/MedicalWebsite.tsx',{'@/lib/website-templates':catalog,'./BeautyWebsite':beauty,'./MedicalWebsite.module.css':css});
for (const id of ['nacre-aesthetics','lumivie-skin','luneform-aesthetics']) test(id+' is editable, multi-page and mirrors Main without exposing sample contact data',()=>{
 const template=catalog.getWebsiteTemplate(id),doc=catalog.templateDraft(template.id,'Our Clinic');
 assert.equal(template.kind,'website');assert.equal(doc.design,'medical');assert.deepEqual(catalog.parseWebsiteDocument(doc),doc);
 assert.deepEqual(doc.reviews,[]);assert.deepEqual(doc.beauty.stylists,[]);assert.equal(doc.beauty.contact.email,'');
 assert.ok(doc.beauty.pages.every(p=>!p.title.includes(template.document.brandName)));
 const paths=catalog.websitePagePaths(template,doc);assert.ok(paths.length>=9);assert.equal(new Set(paths).size,paths.length);
 const titles=new Set();
 for(const path of paths){
  const html=renderToStaticMarkup(createElement(MedicalWebsite,{template,document:doc,pagePath:path,basePath:'/template-canvas/'+template.id,preview:true}));
  assert.equal((html.match(/<h1[\s>]/g)||[]).length,1,path);assert.ok(html.length>4000);
  assert.match(html,/Sign in to JKTL Business/);assert.doesNotMatch(html,/4\.9|312 reviews|6,500|FDA-APPROVED|HIPAA|12 yrs|\$50|wix\.com|Made in Framer/);
  const meta=catalog.websitePageMeta(template,doc,path);assert.ok(meta.description.length>70,path);titles.add(meta.title);
  for(const match of html.matchAll(/href="(\/template-canvas\/[^"#]*)"/g))assert.ok(paths.includes(match[1].replace('/template-canvas/'+id,'').replace(/^\//,'')),match[1]);
  if(['book','contact'].includes(path))assert.match(html,/Preview form/);
 }
 assert.equal(titles.size,paths.length);
 for(const item of [doc.heroImage,doc.beauty.aboutImage,...doc.gallery.map(p=>p.src)])assert.ok(existsSync(new URL('../public'+item,import.meta.url)),item);
 for(const [business,main] of [['lib/website-templates.ts','lib/website-templates.ts'],['components/templates/MedicalWebsite.tsx','components/templates/MedicalWebsite.tsx'],['components/templates/MedicalWebsite.module.css','components/templates/MedicalWebsite.module.css']])assert.equal(readFileSync(new URL('../src/'+business,import.meta.url),'utf8'),readFileSync(new URL('../../jktl-main/'+main,import.meta.url),'utf8'));
});

test('medical variant validation rejects unsupported designs and incomplete documents',()=>{
 const doc=catalog.templateDraft('luneform-aesthetics');
 assert.throws(()=>catalog.parseWebsiteDocument({...doc,medicalVariant:'untrusted'}));
 assert.throws(()=>catalog.parseWebsiteDocument({...doc,beauty:undefined}));
 assert.equal(catalog.parseWebsiteDocument(doc).medicalVariant,'cinematic');
});
