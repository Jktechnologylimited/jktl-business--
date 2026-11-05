// Run against an isolated Next fixture mounting packages/custom-portal/ui.tsx.
// All finance/support responses below are explicit test fixtures, never live payments.
const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{for(const width of [1440,390]){
const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const invoice={id:'10000000-0000-4000-8000-000000000001',invoice_number:'JKTL-TEST-001',description:'Test annual infrastructure',customer_name:'Test Customer',project_name:'Test Website',amount_kobo:10000,paid_kobo:0,outstanding_kobo:10000,next_payment_kobo:4000,status:'OPEN',display_status:'ISSUED',due_on:'2027-01-01',line_items:[{description:'Test infrastructure',quantity:1,unitKobo:10000}],instalments:[{dueOn:'2026-12-01',amountKobo:4000},{dueOn:'2027-01-01',amountKobo:6000}]};
let created=false,replied=false,uploaded=false,paid=false;
await page.route('**/fixture-api/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname.replace('/fixture-api','');let data;
if(path==='/billing')data={project:{name:'Test Website',organization:'Test Customer'},services:[],payments:[],balanceKobo:10000,overdueKobo:0};
else if(path==='/invoices')data=[invoice];
else if(path==='/invoices/'+invoice.id)data=invoice;
else if(path.endsWith('/pay')){assert.equal(req.postDataJSON().amountKobo,4000);paid=true;data={url:'https://checkout.paystack.com/jktl-test-fixture'};}
else if(path==='/support'&&req.method()==='POST'){created=true;data={id:invoice.id};}
else if(path==='/support')data=created?[{id:invoice.id,subject:'Test ticket',status:'WAITING'}]:[];
else if(path.endsWith('/replies')){replied=true;data={saved:true};}
else if(path.endsWith('/attachments')&&req.method()==='POST'){uploaded=true;data={id:'test-attachment'};}
else if(path.endsWith('/attachments'))data=uploaded?[{id:'test-attachment',file_name:'proof.pdf',size:20}]:[];
else if(path.startsWith('/support/'))data={case:{id:invoice.id,subject:'Test ticket',status:'WAITING'},messages:[{id:'m1',sender:'support',body:'Public support response'},...(replied?[{id:'m2',sender:'user',body:'Thanks for your help'}]:[])]};
else return route.fulfill({status:404,json:{error:'Missing test fixture'}});
await route.fulfill({json:{data}});});
await page.route('https://checkout.paystack.com/**',route=>route.fulfill({body:'Mock checkout — no real transaction',contentType:'text/html'}));
await page.goto(process.env.PORTAL_FIXTURE_ORIGIN||'http://localhost:3174');await page.getByRole('heading',{name:'Test Website',exact:true}).waitFor();
await page.getByRole('button',{name:'Invoices',exact:true}).click();await page.getByRole('button',{name:/JKTL-TEST-001/}).click();await page.getByRole('link',{name:'Download PDF invoice'}).waitFor();assert.equal(await page.locator('input[name="amount"]').inputValue(),'40');
await page.getByRole('button',{name:'Pay securely to JKTL'}).click();await page.waitForURL('https://checkout.paystack.com/**');assert.ok(paid);
await page.goto(process.env.PORTAL_FIXTURE_ORIGIN||'http://localhost:3174');await page.getByRole('button',{name:'Support',exact:true}).click();await page.getByLabel('Subject',{exact:true}).fill('Test ticket');await page.getByLabel('How can we help?').fill('Please help with my test website.');await page.getByRole('button',{name:'Open support ticket'}).click();await page.getByText('Public support response',{exact:true}).waitFor();assert.ok(created);
await page.getByLabel('Reply',{exact:true}).fill('Thanks for your help');await page.getByRole('button',{name:'Send reply'}).click();await page.getByText('Thanks for your help',{exact:true}).waitFor();assert.ok(replied);
await page.locator('input[type="file"]').setInputFiles({name:'proof.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-test fixture')});await page.getByRole('link',{name:/proof.pdf/}).waitFor();assert.ok(uploaded);
assert.deepEqual(errors,[]);await page.screenshot({path:`/workspace/exports/custom-portal-${width}.png`});await context.close();}
console.log('PASS: desktop/mobile invoice details, instalment checkout, support conversation and attachments (mocked browser responses).');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
