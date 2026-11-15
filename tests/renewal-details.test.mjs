import test from 'node:test';
import assert from 'node:assert/strict';
import { renewalFixture } from './fixtures/renewal-details-db.mjs';
import { reminderBucket,renewalDay,renewalMessage } from '../src/lib/renewals/model.ts';

test('monthly cadence and renewal emails use real service scope, amounts and readable dates',()=>{
 for(const [day,bucket] of [[30,null],[8,null],[7,'7'],[4,'7'],[3,'3'],[1,'1'],[0,'due'],[-7,'overdue-7']])assert.equal(reminderBucket(day,'MONTHLY'),bucket);
 assert.equal(renewalDay(new Date('2027-07-01T00:00:00Z')),'2027-07-01');
 const m=renewalMessage({business_name:'Example Firm',name:'Annual infrastructure',kind:'OTHER',billing_interval:'ANNUAL',due_on:new Date('2027-07-01T00:00:00Z'),amount_kobo:11700000,service_scope:'Domain, hosting, business email, database, cloud storage, SSL/security/maintenance',path:'/business/renewals',days_left:14});
 assert.match(m.detail,/1 July 2027/);assert.match(m.detail,/117,000/);assert.match(m.detail,/cloud storage/);assert.match(m.subject,/Example Firm/);assert.equal(m.actionLabel,'Review renewal');
 assert.doesNotMatch(m.detail,/undefined|wholesale|wallet/i);
});
test('contact editing, history, linked contracts, tenant isolation and reminder freshness use real SQL',async()=>{
 const f=await renewalFixture();
 try{
  const a=await f.account(),b=await f.account('Another tenant');
  const input={businessName:'Example Firm',contactName:'Customer',billingEmail:'billing@example.test',phone:'08012345678',additionalEmails:['other@example.test'],clientStatus:'ACTIVE',notes:'Owner-provided contact',revision:0};
  await f.contacts.saveCommunicationDetails(a.org,input,'mock-owner');
  await assert.rejects(f.contacts.saveCommunicationDetails(a.org,input,'mock-owner'),/changed/);
  assert.equal((await f.q('SELECT email FROM users WHERE id=$1',[a.user]))[0].email,a.user+'@example.test');
  const p=crypto.randomUUID(),s=crypto.randomUUID();
  await f.q("INSERT INTO custom_projects VALUES($1,$2,'LIVE')",[p,a.org]);
  await f.q("INSERT INTO custom_services(id,organization_id,project_id,category,name,description,next_due_on,amount_kobo,discount_kobo,status,interval) VALUES($1,$2,$3,'MAINTENANCE','Cloud infrastructure','Domain, hosting and business email',current_date+6,11700000,0,'PROPOSED','ANNUAL')",[s,a.org,p]);
  const id=(await f.q("INSERT INTO renewal_tracked_services(organization_id,name,kind,due_on,amount_kobo,created_by,service_scope,billing_interval,source_custom_service_id,project_id,last_paid_on,last_paid_kobo) VALUES($1,'Infrastructure','OTHER',current_date+6,11700000,'mock-owner','Domain, hosting, email, database, cloud storage and SSL/security/maintenance','ANNUAL',$2,$3,'2026-06-30',11700000) RETURNING id",[a.org,s,p]))[0].id;
  const key='tracked:'+id;
  let items=await f.q('SELECT * FROM renewal_details WHERE organization_id=$1',[a.org]);assert.equal(items.length,1);assert.equal(items[0].recipient,input.billingEmail);assert.equal(items[0].business_name,input.businessName);
  assert.equal((await f.q('SELECT * FROM renewal_details WHERE organization_id=$1',[b.org])).length,0);
  await assert.rejects(f.q('INSERT INTO renewal_tracked_services(organization_id,name,kind,created_by,source_custom_service_id,status) VALUES($1,\'Wrong tenant\',\'OTHER\',\'mock-owner\',$2,\'CANCELLED\')',[b.org,s]),/foreign key/i);
  await f.service.queueRenewal(key);await f.service.dispatchRenewals();assert.equal(f.sent.length,1);assert.match(f.sent[0].detail,/cloud storage/);
  // Acceptance keeps the stable reminder key, so switching to the native service
  // cannot cause a second email for the same cycle/window.
  await f.q("UPDATE custom_services SET status='ACTIVE',accepted_at=now() WHERE id=$1",[s]);
  items=await f.q('SELECT * FROM renewal_details WHERE organization_id=$1',[a.org]);assert.equal(items.length,1);assert.equal(items[0].item_key,key);
  assert.equal(await f.service.queueRenewal(key),null);
  // A changed contact cancels queued copy rather than mailing the old address.
  await f.q("UPDATE renewal_reminders SET state='CANCELLED'");
  await f.q('UPDATE custom_services SET next_due_on=current_date+5 WHERE id=$1',[s]);
  await f.service.queueRenewal(key,true);
  await f.contacts.saveCommunicationDetails(a.org,{...input,billingEmail:'new@example.test',revision:1},'mock-owner');
  await f.service.dispatchRenewals();assert.equal(f.sent.length,1);
  const update=new FormData();
  for(const [k,v] of Object.entries({organization:a.org,id,revision:'1',name:'Cloud infrastructure',kind:'OTHER',due:'2027-07-01',amount:'117000',interval:'ANNUAL',scope:'Domain, hosting, business email, database, storage, SSL',lastPaidOn:'2026-06-30',lastPaidAmount:'117000',paymentNote:'Owner reported; not provider verified',remindersEnabled:'on'}))update.set(k,v);
  await f.actions.saveTrackedRenewalAction(update);
  await assert.rejects(f.actions.saveTrackedRenewalAction(update),/changed/);
  const saved=(await f.q('SELECT * FROM renewal_tracked_services WHERE id=$1',[id]))[0];assert.equal(Number(saved.last_paid_kobo),11700000);assert.equal(saved.service_scope,'Domain, hosting, business email, database, storage, SSL');
  assert.equal((await f.q('SELECT count(*)::int n FROM custom_invoices'))[0].n,0);
  await f.contacts.saveCommunicationDetails(a.org,{...input,clientStatus:'PAUSED',revision:2},'mock-owner');
  await assert.rejects(f.service.queueRenewal(key,true),/enable/);
  assert.ok((await f.q('SELECT count(*)::int n FROM renewal_audit'))[0].n>=4);
  // Monthly subscriptions outside seven days do not enter the automatic queue.
  const monthly=(await f.q("INSERT INTO renewal_tracked_services(organization_id,name,kind,due_on,amount_kobo,created_by,billing_interval) VALUES($1,'Monthly hosting','HOSTING',current_date+8,350000,'mock-owner','MONTHLY') RETURNING id",[b.org]))[0].id;
  await f.q('UPDATE renewal_settings SET enabled=true');
  await f.service.runCentralRenewals();assert.equal(f.sent.length,1);
  await f.q('UPDATE renewal_tracked_services SET due_on=current_date+3 WHERE id=$1',[monthly]);
  await f.service.runCentralRenewals();assert.equal(f.sent.length,2);assert.match(f.sent[1].subject,/monthly renewal/);
  await f.service.runCentralRenewals();assert.equal(f.sent.length,2);
  // SQL JSON objects may reorder keys; identical retry payloads remain identical.
  f.transport.outcome='failed';
  await f.q('UPDATE renewal_tracked_services SET due_on=current_date+2 WHERE id=$1',[monthly]);
  await f.service.queueRenewal('tracked:'+monthly,true);await f.service.dispatchRenewals();
  await f.q("UPDATE renewal_reminders SET next_attempt_at=now()-interval '1 minute' WHERE state='FAILED'");
  await f.service.dispatchRenewals();assert.equal(f.sent.length,4);assert.deepEqual(f.sent[2],f.sent[3]);
  // Invalid dates/header injection and overprecision never reach the database.
  const bad=new FormData();bad.set('billingEmail','ok@example.test\r\nBcc: victim@example.test');bad.set('clientStatus','ACTIVE');bad.set('revision','0');
  assert.throws(()=>f.input.communicationInput(bad),/valid/);assert.throws(()=>f.input.renewalDate('2026-02-30'),/calendar/);assert.throws(()=>f.input.renewalAmount('1.001'),/decimal/);
 }finally{await f.db.close();}
});
