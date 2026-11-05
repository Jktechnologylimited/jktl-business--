const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});
   await context.addInitScript(() => {
    window.__runnerAudioTones = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
     window.__runnerAudioTones++;
     return original.call(this);
    };
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto((process.env.TYCOON_TEST_ORIGIN||'http://localhost:3142')+'/play/run');
   await page.locator('canvas[data-webgl-ready]').waitFor({timeout:60000});
   assert.equal(await page.locator('[data-runner]').getAttribute('data-chaser'),'masquerade');
   assert.equal(await page.evaluate(()=>window.__runnerAudioTones),0);
   await page.getByRole('button',{name:'Start running',exact:true}).click();
   await page.waitForFunction(()=>Number(document.querySelector('[data-run-score]').textContent.replace(/,/g,''))>0);
   await page.waitForFunction(()=>window.__runnerAudioTones>0);
   assert.ok(Number(await page.locator('[data-runner]').getAttribute('data-chase-gap'))>7);
   await page.getByRole('button',{name:'Mute sounds',exact:true}).click();
   const muted=await page.evaluate(()=>window.__runnerAudioTones);
   await page.waitForTimeout(250);
   assert.equal(await page.evaluate(()=>window.__runnerAudioTones),muted);
   await page.getByRole('button',{name:'Enable sounds',exact:true}).click();
   await page.waitForFunction(previous=>window.__runnerAudioTones>previous,muted);
   if(width===390){
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:420}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:250,y:420}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await page.locator('[data-runner]').getAttribute('data-lane'),'1');
    await page.getByRole('button',{name:'Move left',exact:true}).click();
   }
   await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[data-runner]').getAttribute('data-lane'),'-1');
   await page.getByRole('button',{name:'Move right',exact:true}).click();assert.equal(await page.locator('[data-runner]').getAttribute('data-lane'),'0');
   await page.getByRole('button',{name:'Jump',exact:true}).click();assert.equal(await page.locator('[data-runner]').getAttribute('data-jumping'),'true');
   await page.waitForFunction(()=>document.querySelector('[data-runner]').dataset.jumping==='false');
   await page.getByRole('button',{name:'Slide',exact:true}).click();assert.equal(await page.locator('[data-runner]').getAttribute('data-sliding'),'true');
   await page.getByRole('button',{name:'Pause run',exact:true}).click();
   const pausedTones=await page.evaluate(()=>window.__runnerAudioTones);
   const score=await page.locator('[data-run-score]').innerText();await page.waitForTimeout(300);assert.equal(await page.locator('[data-run-score]').innerText(),score);
   assert.equal(await page.evaluate(()=>window.__runnerAudioTones),pausedTones);
   await page.getByRole('button',{name:'Resume run',exact:true}).click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`/workspace/exports/jktl-street-run-${width}.png`});
   // Remaining in the centre lane eventually meets one of the deterministic rotating hazards.
   await page.getByRole('button',{name:'Run again',exact:true}).waitFor({timeout:25000});
   await page.getByRole('heading',{name:/The masquerade caught up!|An obstacle ended your run\./}).waitFor();
   const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('jktl-street-run-record-v1')));
   assert.ok(stored.best>0);assert.equal(stored.runs,1);
   await page.getByRole('button',{name:'Run again',exact:true}).click();
   assert.equal(await page.locator('[data-runner]').getAttribute('data-phase'),'running');
   await page.getByRole('button',{name:'Pause run',exact:true}).click();
   await page.getByRole('button',{name:'Mute sounds',exact:true}).click();
   await page.reload();await page.getByRole('button',{name:'Start running',exact:true}).waitFor();
   await page.getByRole('button',{name:'Enable sounds',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>window.__runnerAudioTones),0);
   assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('jktl-street-run-record-v1')))).best,stored.best);
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: 3D runner starts, earns points, changes lanes, jumps, slides, pauses, collides, restarts and saves local records on desktop/mobile; gesture-started audio, mute persistence and pause silence verified.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
