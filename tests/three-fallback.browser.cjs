const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  await page.addInitScript(()=>{
   localStorage.setItem('jktl-pwa-remind-after',String(Date.now()+86400000));
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(kind,...args){return /webgl/.test(kind)?null:original.call(this,kind,...args)};
  });
  await page.route('**/api/tycoon',route=>route.fulfill({json:{signedIn:false,revision:0,document:null}}));
  await page.goto((process.env.TYCOON_TEST_ORIGIN || 'http://localhost:3143')+'/play/tycoon?renderer=3d');
  await page.getByText('3D is unavailable on this device.',{exact:false}).waitFor({timeout:60000});
  await page.locator('[data-world]').waitFor();
  assert.equal(await page.locator('[data-plot]').count(),12);
  await page.locator('[data-plot="0"]').click();
  await page.getByRole('button',{name:'Open business',exact:true}).waitFor();
  console.log('PASS: a device without WebGL falls back to a playable 2D city.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
