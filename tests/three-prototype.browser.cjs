const assert=require('node:assert/strict');
const fs=require('node:fs');

const {chromium}=require('playwright');
const origin=process.env.TYCOON_TEST_ORIGIN || 'http://localhost:3142';
const saved={version:1,week:5,cash:700000,city:'Lagos',plots:Array.from({length:12},(_,id)=>({kind:['suya','salon','provisions','logistics','solar','agency'][id%6],level:1+id%3})),digital:false,solar:false,debt:0,log:['Local prototype benchmark']};
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const THREE=await import('three');
 const reports=[];
 try{
  for(const mode of (process.env.THREE_BENCH_MODES?.split(',') || ['desktop-low','desktop-high','mobile'])){
   const context=await browser.newContext({viewport:mode.startsWith('desktop')?{width:1440,height:1000}:{width:390,height:844},deviceScaleFactor:1});
   await context.addInitScript(({saved})=>{localStorage.setItem('jktl-pwa-remind-after',String(Date.now()+86400000));localStorage.setItem('jktl-tycoon-guest-v1',JSON.stringify(saved));},{saved});
   const page=await context.newPage();const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/tycoon',route=>route.fulfill({json:{signedIn:false,revision:0,document:null}}));
   await page.goto(origin+'/play/tycoon');
   await page.locator('[data-renderer="three"] canvas').waitFor({timeout:60000});
   await page.waitForFunction(()=>Number(document.querySelector('[data-three-stats]')?.dataset.calls)>0,{},{timeout:60000});
   if(mode==='desktop-high') {
    await page.getByLabel('3D quality',{exact:true}).selectOption('high');
    await page.waitForTimeout(2500);
    console.log('high quality started',await page.locator('[data-three-stats]').evaluate(el=>el.dataset));
    await page.waitForFunction(()=>Number(document.querySelector('[data-three-stats]')?.dataset.dpr)===1.25);
   }
   const gpu=await page.locator('canvas').evaluate(canvas=>{const gl=canvas.getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR)};});
   const quality=mode==='desktop-high'?'high':'low';
   assert.equal(await page.locator('[data-renderer]').getAttribute('data-quality'),quality);
   const samples=[];
   for(let sample=0;sample<5;sample++){
    await page.waitForTimeout(1200);
    samples.push(await page.locator('[data-three-stats]').evaluate(el=>Object.fromEntries(Object.entries(el.dataset).filter(([key])=>key!=='threeStats').map(([key,val])=>[key,Number(val)]))));
   }
   console.log(mode,JSON.stringify(samples));
   assert.ok(samples.every(s=>s.calls<40),JSON.stringify(samples));
   assert.ok(samples.every(s=>s.triangles<40000),JSON.stringify(samples));
   assert.ok(samples.every(s=>s.textures<=(quality==='high'?4:1)));
   assert.ok(samples.every(s=>s.dpr<=(quality==='low'?1:1.25)));
   const geometryCounts=samples.map(s=>s.geometries);
   assert.ok(Math.max(...geometryCounts)-Math.min(...geometryCounts)<=1,'Stable GPU geometry count');
   await page.screenshot({path:`/workspace/exports/tycoon-three-${mode}.png`});
   if(mode==='desktop-high') {reports.push({mode,quality,gpu,samples});await context.close();continue;}
   const rect=await page.locator('canvas').boundingBox();
   const camera=new THREE.OrthographicCamera(-rect.width/2,rect.width/2,rect.height/2,-rect.height/2,.1,120);
   camera.position.set(19,21,19);camera.lookAt(0,0,0);
   camera.zoom=Math.max(12,Math.min(rect.width/24,rect.height/19,62));
   camera.updateProjectionMatrix();camera.updateMatrixWorld();
   const target=new THREE.Vector3(-4.5,2.15,-3.5).project(camera);
   await page.locator('canvas').click({position:{x:(target.x+1)*rect.width/2,y:(1-target.y)*rect.height/2}});
   await page.getByRole('button',{name:/Upgrade ·/}).waitFor();
   await page.getByRole('button',{name:'Close game panel',exact:true}).click();
   await page.getByRole('button',{name:'Plot 1: suya',exact:true}).focus();
   await page.keyboard.press('Enter');
   await page.getByRole('button',{name:/Upgrade ·/}).waitFor();
   await page.getByRole('button',{name:'Close game panel',exact:true}).click();
   await page.getByRole('button',{name:'Ⅱ Pause',exact:true}).click();
   assert.equal(await page.locator('[data-renderer]').getAttribute('data-animated'),'false');
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.getByRole('button',{name:'▶ Resume',exact:true}).click();
   assert.equal(await page.locator('[data-renderer]').getAttribute('data-animated'),'false');
   assert.equal(await page.getByRole('button',{name:'Use 2D',exact:true}).count(),0);
   assert.equal(await page.locator('[data-world]').count(),0);
   await page.locator('canvas[data-webgl-ready]').waitFor();
   await page.locator('canvas').evaluate(canvas=>canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
   await page.getByRole('button',{name:'Retry 3D',exact:true}).waitFor();
   assert.equal(await page.locator('[data-world]').count(),0);
   await page.getByRole('button',{name:'Retry 3D',exact:true}).click();
   await page.locator('canvas[data-webgl-ready]').waitFor();
   assert.deepEqual(errors,[]);
   reports.push({mode,quality,gpu,samples});await context.close();
  }
  fs.writeFileSync('/workspace/exports/tycoon-three-benchmark.json',JSON.stringify({environment:'Cloud Chromium using software SwiftShader WebGL; mobile viewport is not a physical phone.',origin,recordedAt:new Date().toISOString(),reports},null,2));
  console.log('PASS: populated 3D city, quality limits, GPU budgets, resource stability, keyboard selection, motion controls, 3D-only rendering and context-loss retry.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
