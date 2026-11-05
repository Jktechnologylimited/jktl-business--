// Isolated fixture: real composer/templates, mocked actions; no actual email.
const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
 await page.goto((process.env.OUTREACH_FIXTURE_ORIGIN||'http://localhost:3178')+'/outreach/affiliates');
 assert.equal(await page.getByRole('region',{name:'Business account outreach'}).count(),0);
 for(const [title,audience,count] of [['New affiliate welcome','NEW_AFFILIATES',5],['Existing affiliate action plan','EXISTING_AFFILIATES',1],['First promotion checklist','ACTIVE_AFFILIATES',6]]){
  await page.getByRole('button',{name:title,exact:true}).click();
  assert.equal(await page.getByLabel('Recipient category',{exact:true}).inputValue(),audience);
  assert.equal(await page.getByLabel('Message type',{exact:true}).inputValue(),'operational');
  assert.equal(await page.getByLabel('Reply-To Email (optional)',{exact:true}).inputValue(),'info@jktl.com.ng');
  assert.match(await page.getByLabel('Email message',{exact:true}).inputValue(),/business\.jktl\.com\.ng\/affiliates/);
  await page.getByRole('button',{name:'Preview and count recipients',exact:true}).click();
  await page.getByText(`${count} unique eligible recipients.`,{exact:true}).waitFor();
  assert.ok(await page.getByRole('button',{name:'Queue individual emails',exact:true}).isDisabled());
 }
 assert.equal(await page.evaluate(()=>window.fixtureQueued||0),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:`/workspace/exports/affiliate-email-starters-${width}.png`,fullPage:true});await context.close();
}console.log('PASS: new/existing/all-active affiliate starters select correct audience, copy, Reply-To and preview; no sends (desktop/mobile fixtures).');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
