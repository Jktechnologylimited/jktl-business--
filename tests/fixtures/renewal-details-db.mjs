import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { load } from "./lifecycle-db.mjs";
import * as model from "../../src/lib/renewals/model.ts";
import { mailAddress } from "../../src/lib/mail/addresses.ts";
export { load };
export async function renewalFixture() {
 const db=new PGlite(),q=async(s,p=[]) => (await db.query(s,p)).rows;
 await db.exec(`
 CREATE TABLE organizations(id uuid PRIMARY KEY,name text);
 CREATE TABLE users(id uuid PRIMARY KEY,email text);
 CREATE TABLE business_profiles(organization_id uuid,display_name text);
 CREATE TABLE organization_members(id uuid DEFAULT gen_random_uuid(),organization_id uuid,user_id uuid,email text,role text,active boolean,created_at timestamptz DEFAULT now());
 CREATE TABLE domain_assets(id uuid DEFAULT gen_random_uuid(),organization_id uuid,domain text,expires_at timestamptz);
 CREATE TABLE website_plan_subscriptions(organization_id uuid,plan_id text,period_end timestamptz,status text,cancel_at_period_end boolean DEFAULT false);
 CREATE TABLE infrastructure_accounts(id uuid DEFAULT gen_random_uuid(),organization_id uuid,plan_name text,renewal_date date,price_kobo_per_year bigint,subscription_status text);
 CREATE TABLE email_services(id uuid DEFAULT gen_random_uuid(),organization_id uuid,domain text,renews_at timestamptz,period_price_kobo bigint,license_type text,status text);
 CREATE TABLE custom_projects(id uuid PRIMARY KEY,organization_id uuid,status text);
 CREATE TABLE custom_services(id uuid DEFAULT gen_random_uuid(),organization_id uuid,project_id uuid,category text,name text,description text,next_due_on date,amount_kobo bigint,discount_kobo bigint,status text,accepted_at timestamptz,interval text);
 CREATE TABLE domain_outbox(id serial,organization_id uuid,domain text,sent_at timestamptz,event text);
 CREATE TABLE email_outbox(id serial,organization_id uuid,sent_at timestamptz,event_key text);
 CREATE TABLE custom_outbox(id serial,sent_at timestamptz,event_key text);
 CREATE TABLE custom_invoices(id uuid,service_id uuid,due_on date);
 CREATE TABLE email_send_history(attempt_key text,provider_state text,provider_message_id text);
 `);
 for(const name of ['068_renewal_safety.sql','080_renewal_communication_details.sql'])await db.exec(readFileSync(new URL('../../migrations/'+name,import.meta.url),'utf8'));
 // Repeated setup must keep its original view contract and every customer record.
 await db.exec(readFileSync(new URL('../../migrations/068_renewal_safety.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../../migrations/080_renewal_communication_details.sql',import.meta.url),'utf8'));
 const sent=[],transport={outcome:'accepted'};
 const service=load('src/lib/renewals/service.ts',{
  'server-only':{},'@/lib/custom/service':{query:q},'@/lib/mail/addresses':{mailAddress},'./model':model,
  '@/lib/db/push':{getNotificationPrefs:async()=>({pushEnabled:false})},'@/lib/push':{sendPush:async()=>{}},
  '@/lib/email':{sendCustomNoticeEmail:async p=>{sent.push(p);return transport.outcome==='accepted'?{ok:true,providerId:'mock-only'}:{ok:false};}},
 });
 const contacts=load('src/lib/renewals/contact-store.ts',{'server-only':{},'@/lib/custom/service':{query:q}});
 const input=load('src/lib/renewals/details.ts',{'@/lib/mail/addresses':{mailAddress}});
 const actions=load('src/lib/actions/renewal-actions.ts',{
  'next/server':{after:()=>{throw Error('No actual sends in fixture');}},'next/cache':{revalidatePath:()=>{}},
  '@/lib/admin-session':{requireAdminCapability:async()=>({id:'mock-owner'})},'@/lib/custom/service':{query:q},
  '@/lib/mail/addresses':{mailAddress},'@/lib/custom/model':{id:v=>v},'@/lib/renewals/details':input,
  '@/lib/renewals/contact-store':contacts,'@/lib/renewals/service':service,
 });
 async function account(name='Example business'){
  const org=crypto.randomUUID(),user=crypto.randomUUID();
  await q('INSERT INTO organizations VALUES($1,$2)',[org,name]);await q('INSERT INTO users VALUES($1,$2)',[user,user+'@example.test']);
  await q("INSERT INTO organization_members(organization_id,user_id,email,role,active) VALUES($1,$2,$3,'owner',true)",[org,user,user+'@example.test']);
  await q('INSERT INTO business_profiles VALUES($1,$2)',[org,name]);return{org,user};
 }
 return{db,q,service,contacts,input,actions,sent,transport,account};
}
