// Mount the real ComposeEmail component in an isolated fixture with mock actions.
// These checks never contact an email provider or send to real customers.
const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.OUTREACH_FIXTURE_ORIGIN||'http://localhost:3178')+'/outreach');
 const review=page.getByRole('region',{name:'Business audience review'});
 await review.getByText(/21 matching business-owner emails/).waitFor();assert.match(await review.innerText(),/21 eligible/);
 await page.getByRole('button',{name:'Account support check-in',exact:true}).click();
 assert.equal(await page.getByLabel('Reply-To Email (optional)',{exact:true}).inputValue(),'info@jktl.com.ng');
 await page.getByRole('button',{name:'Preview and count recipients',exact:true}).click();await page.getByText('21 unique eligible recipients.',{exact:true}).waitFor();
 const queue=page.getByRole('button',{name:'Queue individual emails',exact:true});assert.ok(await queue.isDisabled());
 await page.getByRole('checkbox',{name:/I reviewed this message/}).check();assert.ok(await queue.isDisabled());
 await page.getByRole('checkbox',{name:/The main message is necessary/}).check();assert.ok(await queue.isEnabled());
 await page.screenshot({path:`/workspace/exports/business-email-preview-${width}.png`,fullPage:true});
 await queue.click();await page.waitForFunction(()=>window.fixtureQueued===1);
 await page.getByRole('button',{name:'Custom domain upgrade',exact:true}).click();await review.getByText(/2 matching business-owner emails/).waitFor();assert.match(await review.innerText(),/0 eligible/);
 assert.equal(await page.getByLabel('Message type',{exact:true}).inputValue(),'marketing');
 await page.getByRole('button',{name:'Preview and count recipients',exact:true}).click();await page.getByText('No eligible recipients match this audience and its email preferences.',{exact:true}).waitFor();assert.equal(await page.locator('iframe').count(),0);
 await page.getByLabel('Recipient category',{exact:true}).selectOption('SELECTED_BUSINESSES');await page.getByLabel('Message type',{exact:true}).selectOption('operational');
 await review.getByText(/21 matching business-owner emails/).waitFor();await page.getByText('Review account list',{exact:true}).click();await page.getByRole('checkbox',{name:'Select owner1@example.test',exact:true}).check();
 await page.waitForFunction(()=>document.querySelector('[aria-label="Business audience review"]').textContent.includes('1 eligible'));
 assert.ok(await page.getByRole('checkbox',{name:'Select owner1@example.test',exact:true}).isChecked());
 assert.equal(await page.getByLabel('Selected account emails',{exact:true}).inputValue(),'owner1@example.test');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await context.close();
}console.log('PASS: desktop/mobile business audiences, template types, Reply-To, selection, preview, confirmation and zero-eligible promotional handling (mock actions only).');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
