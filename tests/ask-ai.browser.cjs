const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root='/tmp/jktl-ask-ai-ui',repo=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  let base=root,relative=pathname==='/'?'index.html':pathname.slice(1);
  if(pathname.startsWith('/_next/static/')){base=path.join(repo,'.next/static');relative=pathname.slice('/_next/static/'.length);}
  const file=path.resolve(base,relative);
  if(!file.startsWith(base+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.ttf')?'font/ttf':'text/html');res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.goto('http://127.0.0.1:'+server.address().port+'/');
  const calls=()=>page.evaluate(()=>({...window.fixtureTransport.calls}));
  await page.getByRole('button',{name:'Ask AI',exact:true}).waitFor();assert.deepEqual(await calls(),{create:0,send:0,read:0,human:0});
  await page.getByRole('button',{name:'Ask AI',exact:true}).click();
  await page.getByRole('dialog',{name:'JKTL AI'}).waitFor();assert.deepEqual(await calls(),{create:0,send:0,read:0,human:0});
  await page.getByLabel('Ask JKTL AI',{exact:true}).fill('How do I publish my website?');await page.getByRole('button',{name:'Send question'}).click();
  await page.getByText('Use the Website screen to save, preview and publish.').waitFor();
  assert.deepEqual(await calls(),{create:1,send:0,read:1,human:0});
  assert.ok((await page.getByRole('link',{name:'Open screen'}).first().getAttribute('href')).startsWith('/business'));
  assert.equal(await page.getByRole('link',{name:'Read full guide'}).first().getAttribute('href'),'/help/first-website');
  await page.getByRole('button',{name:'Close JKTL AI'}).click();await page.clock.runFor(65000);
  assert.deepEqual(await calls(),{create:1,send:0,read:1,human:0});
  await page.getByRole('button',{name:'Ask AI',exact:true}).click();await page.getByText('Use the Website screen to save, preview and publish.').waitFor();
  await page.getByRole('button',{name:'Talk to a person'}).click();await page.getByText(/Your request is in the support queue/).waitFor();
  assert.deepEqual(await calls(),{create:1,send:0,read:2,human:1});
  await page.clock.runFor(65000);assert.equal((await calls()).read,2);
  await page.getByRole('button',{name:'Check replies'}).click();assert.equal((await calls()).read,3);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const box=await page.getByRole('dialog',{name:'JKTL AI'}).boundingBox();assert.ok(box.height<=900*.7+2);assert.ok(box.x>=0&&box.x+box.width<=width);
  await page.screenshot({path:`/tmp/jktl-ask-ai-${width}.png`,fullPage:true});
  await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'JKTL AI'}).waitFor({state:'detached'});assert.equal(await page.getByRole('button',{name:'Ask AI',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.getByRole('button',{name:'Switch account'}).click();await page.getByRole('button',{name:'Ask AI',exact:true}).click();assert.equal(await page.getByText('Use the Website screen to save, preview and publish.').count(),0);
  await page.getByRole('button',{name:'Switch mode'}).click();await page.getByRole('button',{name:'Ask AI',exact:true}).click();
  const before=await calls();await page.getByLabel('Ask JKTL AI',{exact:true}).fill('How do I renew my domain?');await page.getByRole('button',{name:'Send question'}).click();await page.getByText(/Knowledge-base mode/).waitFor();assert.deepEqual(await calls(),before);
  await page.getByRole('button',{name:'Talk to a person'}).click();await page.getByText(/Sign in to your live account to send/).waitFor();assert.deepEqual(await calls(),before);
  await page.getByRole('button',{name:'Switch mode'}).click();await page.evaluate(()=>{window.fixtureTransport.fail=true;});await page.getByRole('button',{name:'Ask AI',exact:true}).click();
  await page.getByLabel('Ask JKTL AI',{exact:true}).fill('How do I publish my first website?');await page.getByRole('button',{name:'Send question'}).click();await page.getByRole('alert').waitFor();
  assert.equal((await calls()).create,before.create+1);await page.clock.runFor(65000);assert.equal((await calls()).create,before.create+1);
  assert.ok(await page.getByRole('link',{name:'Help & support',exact:true}).isVisible());
  const text=await page.locator('[aria-labelledby="team-structure-title"]').innerText();assert.doesNotMatch(text,/John|Beke|Private Person/);
  assert.deepEqual(errors,[]);await page.close();
 }
 const outage=await browser.newPage({viewport:{width:390,height:900}}),outageErrors=[];
 outage.on('pageerror',e=>outageErrors.push(e.message));
 const block=route=>route.request().url().endsWith('/app.js')?route.continue():route.abort();
 await outage.route('**/*.js',block);
 await outage.goto('http://127.0.0.1:'+server.address().port+'/');
 await outage.getByRole('button',{name:'Ask AI',exact:true}).click();
 await outage.getByText('JKTL AI couldn’t load.',{exact:false}).waitFor();
 assert.ok(await outage.getByRole('heading',{name:'Business workspace fixture'}).isVisible());
 assert.deepEqual(await outage.evaluate(()=>window.fixtureTransport.calls),{create:0,send:0,read:0,human:0});
 await outage.unroute('**/*.js',block);
 await outage.getByRole('button',{name:'Retry loading chat'}).click();
 await outage.getByRole('dialog',{name:'JKTL AI'}).waitFor();
 assert.deepEqual(outageErrors,[]);await outage.close();
 console.log('Ask AI passed lazy opening, send/link, human handoff, no polling/retries, close/reopen, identity isolation, demo/outage fallback, failed-chunk recovery, keyboard and three viewport checks.');}
 finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
