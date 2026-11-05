// Isolated PostgreSQL and provider fixtures only. Never sends real email.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';import ts from 'typescript';import {PGlite} from '@electric-sql/pglite';import {unified} from 'unified';import remarkParse from 'remark-parse';import * as permissions from '../src/lib/admin-permissions.ts';import * as addresses from '../src/lib/mail/addresses.ts';import * as outreach from '../src/lib/mail/business-outreach.ts';
function load(file,deps){const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(n=>{if(!(n in deps))throw Error('Missing fixture '+n);return deps[n];},m,m.exports);return m.exports;}
const layout=load('src/lib/mail/layout.ts',{'./addresses':addresses});
const compose=load('src/lib/mail/compose.tsx',{'server-only':{},'./business-outreach':outreach,unified:{unified},'remark-parse':{__esModule:true,default:remarkParse},'./layout':layout,'@/lib/admin-permissions':permissions,'./addresses':addresses});
test('business audiences use actual owners, age and publication/domain state; previews and sends recheck eligibility',async()=>{
 const db=new PGlite(),q=async(sql,args=[]) =>(await db.query(sql,args)).rows;
 try{
  for(const f of readdirSync(new URL('../migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8').replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g,''));
  const actor=(await q("INSERT INTO admin_users(name,email,password_hash,role) VALUES('Team owner','team@example.test','unused','owner') RETURNING id,role"))[0];
  async function account(email,age,{role='owner',published=false,domain='',active=true}={}){
   const user=(await q("INSERT INTO users(name,email,password_hash,created_at) VALUES('Business owner',$1,'unused',now()-$2::int*interval '1 day') RETURNING id",[email,age]))[0];
   const org=(await q("INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id",[email,'org-'+user.id]))[0];
   await q("INSERT INTO organization_members(organization_id,user_id,name,email,role,active) VALUES($1,$2,'Member',$3,$4,$5)",[org.id,user.id,email,role,active]);
   await q("INSERT INTO business_profiles(organization_id,display_name,subdomain,published,custom_domain) VALUES($1,'Business',$2,$3,$4)",[org.id,'site-'+user.id,published,domain]);
   return {user,org};
  }
  const fresh=await account('new@example.test',2,{published:true});
  await account('existing@example.test',50,{published:true,domain:'existing.example'});
  await account('pending-domain@example.test',10,{published:true,domain:'pending.example'});
  await account('unpublished@example.test',4);
  await account('staff@example.test',2,{role:'staff',published:true});
  await account('inactive@example.test',2,{active:false,published:true});
  await q("INSERT INTO organization_members(organization_id,user_id,name,email,role) VALUES($1,$2,'Duplicate membership','new@example.test','owner')",[fresh.org.id,fresh.user.id]);
  const owners=await compose.mailRecipients(q,'owner','BUSINESS_ACCOUNTS',[],undefined,'operational');assert.equal(owners.length,4);assert.equal(new Set(owners).size,4);
  assert.equal((await compose.mailRecipients(q,'owner','NEW_BUSINESSES',[],undefined,'operational')).length,3);
  assert.deepEqual(await compose.mailRecipients(q,'owner','EXISTING_BUSINESSES',[],undefined,'operational'),['existing@example.test']);
  assert.deepEqual(await compose.mailRecipients(q,'owner','FREE_SUBDOMAINS',[],undefined,'operational'),['new@example.test']);
  assert.deepEqual(await compose.mailRecipients(q,'owner','BUSINESS_ACCOUNTS',[],undefined,'marketing'),[]);
  await assert.rejects(()=>compose.mailRecipients(q,'affiliate_manager','BUSINESS_ACCOUNTS',[],undefined,'operational'),/permissions/);
  await assert.rejects(()=>compose.mailRecipients(q,'owner','SELECTED_BUSINESSES',[],undefined,'operational'));
  assert.deepEqual(await compose.mailRecipients(q,'owner','SELECTED_BUSINESSES',['new@example.test','staff@example.test'],undefined,'operational'),['new@example.test']);
  await q("INSERT INTO email_preferences(email,marketing_opt_in) VALUES('new@example.test',true)");
  assert.deepEqual(await compose.mailRecipients(q,'owner','FREE_SUBDOMAINS',[],undefined,'marketing'),['new@example.test']);
  const branding=layout.brandingSettings({defaultReplyTo:'info@jktl.com.ng',verifiedReplyTo:['info@jktl.com.ng'],postalAddress:'Test fixture company address'});
  let submissions=0;
  const actions=load('src/lib/actions/email-compose-actions.ts',{'next/server':{after:()=>{submissions++;}},'@/lib/admin-session':{requireAdminCapability:async()=>actor},'@/lib/custom/service':{query:q},'@/lib/support/service':{rate:async()=>{}},'@/lib/mail/compose':compose,'@/lib/mail/service':{currentBranding:async()=>branding},'@/lib/mail/addresses':addresses,'@/lib/mail/layout':layout,'@/lib/distribution/notifications':{flushProgramNotices:async()=>{}},'@/lib/mail/business-outreach':outreach});
  const review=await actions.reviewBusinessEmailAudienceAction({audience:'FREE_SUBDOMAINS',kind:'marketing',selected:''});assert.equal(review.matched,1);assert.equal(review.eligible,1);assert.equal(review.contacts[0].email,'new@example.test');assert.equal(review.replyTo,'info@jktl.com.ng');assert.equal(submissions,0);
  const template=outreach.BUSINESS_OUTREACH_TEMPLATES.find(t=>t.id==='domain-upgrade');assert.equal(template.kind,'marketing');
  const preview=await actions.previewComposedEmailAction({audience:'FREE_SUBDOMAINS',kind:'marketing',selected:'',subject:template.subject,body:template.body,replyTo:'info@jktl.com.ng'});assert.equal(preview.count,1);assert.equal(preview.replyTo,'info@jktl.com.ng');assert.equal(submissions,0);
  await q("UPDATE business_profiles SET custom_domain='connected.example' WHERE organization_id=$1",[fresh.org.id]);
  await assert.rejects(()=>actions.sendComposedEmailAction({id:preview.id,count:1,confirmed:true,operationalConfirmed:false}),/eligibility changed/);
  await q("UPDATE business_profiles SET custom_domain='' WHERE organization_id=$1",[fresh.org.id]);
  await actions.sendComposedEmailAction({id:preview.id,count:1,confirmed:true,operationalConfirmed:false});assert.equal(submissions,1);
  const queued=(await q('SELECT recipient_email,reply_to,category FROM distribution_program_notices WHERE composed_id=$1',[preview.id]))[0];assert.equal(queued.reply_to,'info@jktl.com.ng');assert.equal(queued.category,'marketing');
  await q("UPDATE email_preferences SET marketing_suppressed=true WHERE email='new@example.test'");assert.deepEqual(await compose.mailRecipients(q,'owner','FREE_SUBDOMAINS',[],undefined,'marketing'),[]);
  assert.equal((await compose.mailRecipients(q,'owner','FREE_SUBDOMAINS',[],undefined,'operational')).length,1);
 }finally{await db.close();}
});
