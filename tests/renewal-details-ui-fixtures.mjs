import { renewalFixture,load } from './fixtures/renewal-details-db.mjs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readdirSync,readFileSync,writeFileSync } from 'node:fs';
import * as model from '../src/lib/renewals/model.ts';
const f=await renewalFixture();
try{
 const a=await f.account('Example Cloud Client');
 await f.contacts.saveCommunicationDetails(a.org,{businessName:'Example Cloud Client',contactName:'Ada',billingEmail:'billing@example.test',phone:'08012345678',additionalEmails:['additional@example.test'],clientStatus:'ACTIVE',notes:'Priority contact is the billing address.',revision:0},'fixture-owner');
 const tracked=(await f.q("INSERT INTO renewal_tracked_services(organization_id,name,kind,due_on,amount_kobo,created_by,billing_interval,service_scope,last_paid_on,last_paid_kobo,payment_note) VALUES($1,'Annual cloud infrastructure','OTHER',current_date+14,11700000,'fixture-owner','ANNUAL','Domain, hosting, business email, database, cloud storage and SSL/security/maintenance.','2026-06-30',11700000,'Owner-reported history') RETURNING id",[a.org]))[0].id;
 const dependencies={
  '@/lib/admin-page-guard':{guardAdminPage:async()=>{}},'@/lib/custom/service':{query:f.q,owner:async()=>({organizationId:a.org})},
  '@/lib/renewals/service':f.service,'@/lib/renewals/model':model,'@/lib/actions/renewal-actions':f.actions,
  '@/components/distribution/action-form':{ActionForm:({children,className})=>createElement('form',{className},children)},
  'next/link':{__esModule:true,default:({children,...props})=>createElement('a',props,children)},
 };
 dependencies['@/components/admin/business-communication-form']=load('src/components/admin/business-communication-form.tsx',dependencies);
 const page=load('src/app/admin/(command)/emails/renewals/page.tsx',dependencies).default;
 let css='';for(const dir of ['.next/static/css','.next/static/chunks'])try{for(const file of readdirSync(dir))if(file.endsWith('.css'))css+=readFileSync(dir+'/'+file,'utf8');}catch{}
 const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({organization:a.org,edit:tracked,item:'tracked:'+tracked})}));
 writeFileSync('/tmp/jktl-renewal-details.html','<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css+'</style></head><body><main style="max-width:1100px;margin:auto;padding:20px"><h1>JKTL Team</h1>'+html+'</main></body></html>');
 console.log('Rendered actual renewal page and communication form with isolated database fixtures.');
}finally{await f.db.close();}
