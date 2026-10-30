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
  await page.goto((process.env.TYCOON_TEST_ORIGIN || 'http://localhost:3143')+'/play/tycoon');
  await page.getByRole('button',{name:'Retry 3D',exact:true}).waitFor({timeout:60000});
  assert.equal(await page.locator('[data-world]').count(),0);
  await page.getByRole('button',{name:'Retry 3D',exact:true}).click();
  await page.getByRole('button',{name:'Retry 3D',exact:true}).waitFor();
  await page.goto((process.env.TYCOON_TEST_ORIGIN || 'http://localhost:3143')+'/play/run');
  await page.getByRole('button',{name:'Retry 3D',exact:true}).waitFor({timeout:60000});
  assert.equal(await page.locator('[data-world]').count(),0);
  console.log('PASS: Tycoon and Street Run show retry screens without WebGL; no 2D renderer is loaded.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
