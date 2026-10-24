import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as pricing from '../src/lib/website-pricing.ts';
import * as billing from '../src/lib/billing.ts';
function loadAction(stubs) {
 const source=readFileSync(new URL('../src/lib/actions/billing-actions.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',code)((name)=>{if(!(name in stubs))throw new Error(`Missing stub ${name}`);return stubs[name]},module,module.exports);
 return module.exports;
}
test('all five NGN plans have exact totals and honest annual savings',()=>{
 const annual=[0,50000,150000,290000,590000];const monthly=[0,5000,15000,29000,59000];const savings=[0,10000,30000,58000,118000];
 pricing.WEBSITE_PLANS.forEach((plan,i)=>{const quote=pricing.websitePlanQuote(plan.id,'yearly');assert.equal(quote.amountKobo,annual[i]*100);assert.equal(quote.savingsKobo,savings[i]*100);assert.equal(Math.round(quote.monthlyEquivalentKobo/100),Math.round(annual[i]/12));assert.equal(pricing.websitePlanQuote(plan.id,'monthly').amountKobo,monthly[i]*100);assert.equal(quote.currency,'NGN');});
 for(const args of [['bogus','yearly'],['growth','daily'],['toString','monthly']])assert.throws(()=>pricing.websitePlanQuote(...args));
 assert.deepEqual(Object.keys(pricing.PRICING_MARKETS),['NG']);
 const main=readFileSync(new URL('../../jktl-main/lib/website-pricing.ts',import.meta.url),'utf8');assert.equal(main,readFileSync(new URL('../src/lib/website-pricing.ts',import.meta.url),'utf8'));
});
test('renewal dates clamp month end and leap years without overflowing',()=>{
 for(const [date,cycle,expected] of [['2027-01-31T12:30:00Z','monthly','2027-02-28T12:30:00.000Z'],['2028-01-31T12:30:00Z','monthly','2028-02-29T12:30:00.000Z'],['2028-02-29T12:30:00Z','yearly','2029-02-28T12:30:00.000Z'],['2026-10-24T12:30:00Z','yearly','2027-10-24T12:30:00.000Z']]) assert.equal(billing.addBillingCycle(new Date(date),cycle).toISOString(),expected);
});
test('legacy confirmation rejects other tenants, wrong amount/currency and non-subscription metadata',async()=>{
 let transaction;let applied=0;const stubs={
 '@/lib/db/client':{getSql:()=>async()=>[{user_id:'owner'}]},
 '@/lib/session':{requireSession:async()=>({organizationId:'org',userId:'owner'})},
 '@/lib/db/organizations':{getInfrastructure:async()=>({subscriptionStatus:'active'}),getUser:async()=>({email:'owner@example.com'}),getBusinessProfile:async()=>({})},
 '@/lib/db/billing':{applyPaymentSuccess:async()=>{applied++},ensurePlanCode:async()=>{throw new Error('must not create duplicate subscription')},getPaystackSubscriptionCode:async()=>''},
 '@/lib/paystack':{verifyTransaction:async()=>transaction},'@/lib/billing':billing};
 const actions=loadAction(stubs);
 const valid={status:'success',currency:'NGN',amount:500000,paid_at:'2026-10-24T12:00:00Z',metadata:{organizationId:'org',billingCycle:'monthly'},customer:{customer_code:'cus'}};
 for(const override of [{currency:'USD'},{amount:1},{metadata:{organizationId:'other',billingCycle:'monthly'}},{metadata:{organizationId:'org',type:'wallet_topup'}}]){transaction={...valid,...override};assert.equal((await actions.confirmCheckoutAction('ref')).ok,false);}
 assert.equal(applied,0);transaction=valid;assert.equal((await actions.confirmCheckoutAction('ref')).ok,true);assert.equal(applied,1);
 assert.equal((await actions.startCheckoutAction('monthly')).ok,false);
});
