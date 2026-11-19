import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';

// Start the built Main app on port 3317. This uses only public local previews.
const origin = process.env.MEDICAL_TEST_ORIGIN || 'http://127.0.0.1:3317';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try {
  for (const id of ['nacre-aesthetics','lumivie-skin','luneform-aesthetics']) for (const width of [1440,390,320]) {
    const page = await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const response=await page.goto(origin+'/template-canvas/'+id);
    assert.equal(response.status(),200);await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('h1').count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    if(id==='luneform-aesthetics') {const steps=page.getByRole('group',{name:'Explore care steps'});const answer=page.locator('[aria-live="polite"]').first();const before=await answer.innerText();await steps.getByRole('button',{name:'Plan 02'}).click();assert.equal(await steps.getByRole('button',{name:'Plan 02'}).getAttribute('aria-pressed'),'true');assert.notEqual(await answer.innerText(),before);await steps.getByRole('button',{name:'Choose 03'}).focus();await page.keyboard.press('Enter');assert.equal(await steps.getByRole('button',{name:'Choose 03'}).getAttribute('aria-pressed'),'true');}
    if(width<900)await page.getByRole('button',{name:'Open menu',exact:true}).click();
    await page.getByRole('navigation',{name:'Main website navigation'}).getByText('Treatments',{exact:true}).click();
    await page.waitForURL('**/services');await page.getByRole('link',{name:'Explore treatment'}).first().click();
    await page.waitForURL('**/services/*');assert.equal(await page.locator('h1').count(),1);
    await page.goto(origin+'/template-canvas/'+id+'/book');
    for(const [name,value] of [['name','Template Preview'],['email','preview@example.test'],['phone','08000000000'],['date','2027-01-10'],['time','10:00']])await page.locator(`input[name="${name}"]`).fill(value);
    await page.locator('select[name="service"]').selectOption({index:1});
    await page.locator('form button[type="submit"]').click();
    const error=page.locator('form [role="alert"]');await error.waitFor();assert.match(await error.innerText(),/No request was sent/);
    assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`/tmp/${id}-${width}.png`,fullPage:true});await page.close();
    console.log(`Passed ${id} at ${width}px navigation, layout, preview form and console checks.`);
  }
  for(const id of ['nacre-aesthetics','lumivie-skin','luneform-aesthetics']) {
  const page=await browser.newPage({viewport:{width:1000,height:800},reducedMotion:'reduce'});
  await page.goto(origin+'/template-canvas/'+id);await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>Array.from(document.images).filter(image=>{const r=image.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&r.width>0;}).every(image=>image.complete&&image.naturalWidth>0));
  const main=new URL('../../jktl-main/public/template-previews/'+id+'.jpg',import.meta.url);
  await page.screenshot({path:main.pathname,type:'jpeg',quality:78,clip:{x:0,y:0,width:1000,height:676}});
  copyFileSync(main,new URL('../public/template-previews/'+id+'.jpg',import.meta.url));
  await page.close();
  }
  console.log('Matching catalogue thumbnails captured.');
} finally { await browser.close(); }
