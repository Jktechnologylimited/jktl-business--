const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(fs.readFileSync('/tmp/jktl-renewal-details.html','utf8'));
  await page.getByRole('heading',{name:'Business communication details',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Primary billing email',{exact:false}).inputValue(),'billing@example.test');
  await page.getByLabel('Contact person',{exact:true}).fill('Updated contact');
  await page.getByLabel('Client relationship',{exact:false}).selectOption('PAUSED');
  assert.equal(await page.getByLabel('Contact person',{exact:true}).inputValue(),'Updated contact');
  assert.ok(await page.getByRole('heading',{name:'Reminder preview'}).isVisible());
  assert.ok(await page.getByText(/Domain, hosting, business email, database, cloud storage and SSL/).first().isVisible());
  await page.getByLabel('Services included in this renewal').fill('Domain, hosting and business email.');
  assert.equal(await page.getByLabel('Previous payment date').inputValue(),'2026-06-30');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`/tmp/jktl-renewal-details-${width}.png`,fullPage:true});
  await page.close();
 }console.log('Renewal/contact forms and previews passed at 1440, 390 and 320 pixels; no overflow or browser errors.');}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
