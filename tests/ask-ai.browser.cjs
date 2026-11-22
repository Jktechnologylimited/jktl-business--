/* eslint-disable @typescript-eslint/no-require-imports -- Node-only Playwright harness. */
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root='/tmp/jktl-ask-ai-ui',repo=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  let base=root,relative=pathname==='/'?'index.html':pathname.slice(1);
  if(pathname==='/jktl-logo.png'){res.setHeader('Content-Type','image/png');res.end(fs.readFileSync(path.join(repo,'public/jktl-logo.png')));return;}
  if(pathname.startsWith('/_next/static/')){base=path.join(repo,'.next/static');relative=pathname.slice('/_next/static/'.length);}
  const file=path.resolve(base,relative);
  if(!file.startsWith(base+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.ttf')?'font/ttf':'text/html');res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const width of [1440,390,320]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'no-preference'}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.clock.install({time:new Date('2026-11-22T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-22T12:00:01Z'));
   await page.goto('http://127.0.0.1:'+server.address().port+'/');
   const calls=()=>page.evaluate(()=>({...window.fixtureTransport.calls}));
   const status=page.getByRole('status',{name:'Assistant status',exact:true});
   const input=page.getByLabel('Ask JKTL AI',{exact:true});
   const send=async text=>{await input.fill(text);await page.getByRole('button',{name:'Send question',exact:true}).click();};
   const finish=async()=>{await page.getByRole('button',{name:'Show full reply',exact:true}).click();await status.getByText('Done',{exact:false}).waitFor();};
   assert.deepEqual(await calls(),{create:0,send:0,read:0,human:0});
   const helpButton=page.getByRole('button',{name:'Help & support',exact:true});await helpButton.click();const helpPanel=page.getByRole('dialog',{name:'Help & support',exact:true});await helpPanel.waitFor();
   assert.equal(await helpPanel.locator('form[action="/help"]').count(),1);assert.equal(await helpPanel.getByRole('link',{name:'Messages & human support',exact:false}).getAttribute('href'),'/business/help');
   await helpPanel.getByRole('button',{name:'Ask JKTL AI',exact:false}).click();await page.getByRole('dialog',{name:'JKTL AI',exact:true}).waitFor();assert.deepEqual(await calls(),{create:0,send:0,read:0,human:0});
   await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'JKTL AI',exact:true}).waitFor({state:'detached'});assert.equal(await helpButton.evaluate(node=>node===document.activeElement),true);

   await page.getByRole('button',{name:'Ask AI',exact:true}).click();await page.getByRole('dialog',{name:'JKTL AI'}).waitFor();
   assert.deepEqual(await calls(),{create:0,send:0,read:0,human:0});
   await page.evaluate(()=>{window.fixtureTransport.defer=true});
   await send('How do I publish my website?');await status.getByText('Thinking…',{exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Send question',exact:true}).isDisabled(),true);
   await input.fill('What next?');await input.press('Enter');assert.equal((await calls()).create,1);assert.equal((await calls()).send,0);
   await page.evaluate(()=>window.fixtureTransport.release());await status.getByText('Typing…',{exact:true}).waitFor();
   const log=page.getByRole('log',{name:'JKTL AI conversation'});assert.equal(await log.getAttribute('aria-busy'),'true');
   assert.equal(await page.getByRole('link',{name:'Open screen',exact:true}).count(),0);
   await page.clock.runFor(120);
   const partial=await log.locator('article').last().locator('p.whitespace-pre-wrap').innerText();
   assert.ok(partial.length>0&&partial.length<'Use the Website screen to save, preview and publish.'.length);
   await finish();assert.equal(await log.getAttribute('aria-busy'),'false');assert.equal(await input.inputValue(),'What next?');
   assert.deepEqual(await calls(),{create:1,send:0,read:1,human:0});
   assert.equal(await page.getByRole('link',{name:'Read full guide',exact:true}).first().getAttribute('href'),'/help/first-website');
   const beforeMultiline=await calls();await input.fill('Two lines');await input.press('Shift+Enter');assert.ok((await input.inputValue()).includes('\n'));assert.deepEqual(await calls(),beforeMultiline);
   await input.fill('What next?');await input.press('Enter');await status.getByText('Typing…',{exact:true}).waitFor();
   assert.equal(await page.getByText('Use the Website screen to save, preview and publish.',{exact:true}).count(),1);
   await page.clock.runFor(2000);await status.getByText('Done',{exact:false}).waitFor();
   assert.deepEqual(await calls(),{create:1,send:1,read:2,human:0});
   await page.getByRole('button',{name:'Talk to a person',exact:true}).click();await page.getByText(/Your request is in the support queue/).waitFor();
   assert.deepEqual(await calls(),{create:1,send:1,read:3,human:1});await status.getByText('With support',{exact:true}).waitFor();
   await page.clock.runFor(65000);assert.equal((await calls()).read,3);
   await page.evaluate(()=>window.fixtureTransport.messages.push({id:crypto.randomUUID(),sender:'support',body:'Hello, I am reviewing your question.',guide_ids:[]}));
   await page.getByRole('button',{name:'Check replies',exact:true}).click();await page.getByText('Hello, I am reviewing your question.',{exact:true}).waitFor();
   assert.equal((await calls()).read,4);assert.equal(await page.getByRole('button',{name:'Show full reply',exact:true}).count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const box=await page.getByRole('dialog',{name:'JKTL AI'}).boundingBox();assert.ok(box.height<=900*.7+2);assert.ok(box.x>=0&&box.x+box.width<=width);
   await page.screenshot({path:`/tmp/jktl-ask-ai-${width}.png`,fullPage:true});
   await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'JKTL AI'}).waitFor({state:'detached'});
   assert.equal(await page.getByRole('button',{name:'Ask AI',exact:true}).evaluate(node=>node===document.activeElement),true);
   const beforeClose=await calls();await page.clock.runFor(65000);assert.deepEqual(await calls(),beforeClose);
   await page.getByRole('button',{name:'Switch account',exact:true}).click();await page.getByRole('button',{name:'Ask AI',exact:true}).click();assert.equal(await page.getByText('Use the Website screen to save, preview and publish.',{exact:true}).count(),0);
   await send('Another question');await status.getByText('Typing…',{exact:true}).waitFor();
   if(width===1440)await page.getByRole('button',{name:'Close JKTL AI',exact:true}).click();
   else if(width===390)await page.keyboard.press('Escape');
   else await page.getByRole('button',{name:'Ask AI',exact:true}).click();
   await page.clock.runFor(10000);
   const afterClose=await calls();await page.getByRole('button',{name:'Ask AI',exact:true}).click();await status.getByText('Done',{exact:false}).waitFor();
   assert.deepEqual(await calls(),afterClose);assert.equal(await page.getByRole('button',{name:'Show full reply',exact:true}).count(),0);
   await page.getByRole('button',{name:'Switch mode',exact:true}).click();await page.getByRole('button',{name:'Ask AI',exact:true}).click();
   const beforeDemo=await calls();await send('Hi');await finish();
   assert.ok(await page.getByText('Hi! What would you like to do in JKTL Business today?',{exact:true}).isVisible());assert.equal(await page.getByRole('link',{name:'Open screen',exact:true}).count(),0);
   await send('How do I publish my first website?');await finish();const first=await log.locator('article').last().locator('p.whitespace-pre-wrap').innerText();
   await send('What next?');await finish();const next=await log.locator('article').last().locator('p.whitespace-pre-wrap').innerText();assert.notEqual(first,next);assert.match(next,/next part/i);
   await send('Thanks');await finish();assert.ok(await page.getByText('You’re welcome. Is there anything else you’d like help with?',{exact:true}).isVisible());assert.deepEqual(await calls(),beforeDemo);
   await page.emulateMedia({reducedMotion:'reduce'});await send('Hello');await status.getByText('Done',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Show full reply',exact:true}).count(),0);
   await page.emulateMedia({reducedMotion:'no-preference'});await send('Help me publish my website');await status.getByText('Typing…',{exact:true}).waitFor();
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});await status.getByText('Done',{exact:false}).waitFor();await page.clock.runFor(65000);assert.deepEqual(await calls(),beforeDemo);
   await page.evaluate(()=>{delete document.hidden});
   await page.getByRole('button',{name:'Talk to a person',exact:true}).click();await page.getByText(/Sign in to your live account to send/).waitFor();assert.deepEqual(await calls(),beforeDemo);
   await page.getByRole('button',{name:'Switch mode',exact:true}).click();await page.evaluate(()=>{window.fixtureTransport.fail=true});await page.getByRole('button',{name:'Ask AI',exact:true}).click();
   await send('How do I publish my first website?');await page.getByRole('alert').waitFor();await finish();
   assert.equal((await calls()).create,beforeDemo.create+1);await page.clock.runFor(65000);assert.equal((await calls()).create,beforeDemo.create+1);
   assert.ok(await page.getByRole('link',{name:'Help & support',exact:true}).isVisible());assert.deepEqual(errors,[]);
   await page.close();console.log(`Passed Ask AI ${width}px thinking, partial typing, done, history, skip, reduced motion, visibility, handoff and failure checks.`);
  }
  for(const width of [1440,390,320])for(const theme of ['light','dark']){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.getByRole('button',{name:'Business shell fixture',exact:true}).click();await page.getByRole('heading',{name:'Example business dashboard',exact:true}).waitFor();await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   assert.ok(await page.getByRole('link',{name:/^Upgrade/}).isVisible());
   if(width>=1024){const nav=page.getByRole('navigation',{name:'Business navigation',exact:true});assert.ok(await nav.getByRole('link',{name:'Your websites',exact:true}).isVisible());assert.ok(await nav.getByRole('link',{name:'Invoices',exact:true}).isVisible());}
   if(width<1024){await page.evaluate(()=>{const space=document.createElement('div');space.id='scroll-test';space.style.height='1800px';document.querySelector('main').append(space);window.scrollTo(0,800)});}
   const help=page.getByRole('button',{name:'Help & support',exact:true});assert.equal(await help.count(),1);if(width<1024){const bounds=await help.boundingBox();assert.ok(bounds.y>=0&&bounds.y<80)}await help.click();const panel=page.getByRole('dialog',{name:'Help & support',exact:true});await panel.waitFor();const bounds=await panel.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);assert.ok(await panel.getByText('Find a guide, ask a question or follow up with the team.',{exact:true}).isVisible());await panel.getByRole('button',{name:'Ask JKTL AI',exact:false}).click();await page.getByRole('dialog',{name:'JKTL AI',exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await help.evaluate(node=>node===document.activeElement),true);
   if(width<1024){const header=page.locator('header').filter({has:page.locator('details')}).first();await header.locator('summary').click();assert.ok(await header.getByText('Preferences',{exact:true}).isVisible());assert.ok(await header.getByRole('combobox',{name:/Language \/ Harshe/}).isVisible());assert.ok(await header.getByRole('button',{name:/Color theme:/}).isVisible());await header.locator('summary').click();}
   if(width<1024)await page.evaluate(()=>{document.getElementById('scroll-test').remove();window.scrollTo(0,0)});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(await page.evaluate(()=>window.fixtureTransport.calls),{create:0,send:0,read:0,human:0});assert.deepEqual(errors,[]);await page.screenshot({path:'/tmp/jktl-business-help-'+width+'-'+theme+'.png',fullPage:true});
   await page.getByRole('button',{name:'Business help fixture',exact:true}).click();await page.getByRole('heading',{name:'Help & support',exact:true}).waitFor();await page.getByText('Your conversations will appear here after you send a question.',{exact:true}).waitFor();if(width<1280){const compose=await page.getByRole('heading',{name:'Start a conversation',exact:true}).boundingBox(),history=await page.getByRole('heading',{name:'Your conversations',exact:false}).boundingBox();assert.ok(compose.y<history.y);}await page.getByLabel('What do you need help with?',{exact:true}).fill('Publish my website');await page.getByLabel('Describe what you tried',{exact:true}).fill('I saved my website and would like help publishing it.');
   await page.getByRole('button',{name:'Ask AI first',exact:true}).click();await page.getByRole('dialog',{name:'JKTL AI',exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Ask AI first',exact:true}).evaluate(node=>node===document.activeElement),true);assert.equal((await page.evaluate(()=>window.fixtureTransport.calls)).create,0);assert.equal((await page.evaluate(()=>window.fixtureTransport.calls)).human,0);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/jktl-business-support-'+width+'-'+theme+'.png',fullPage:true});await page.close();console.log('Passed Business Help discoverability, preferences and lazy chat at '+width+'px '+theme+'.');
  }
  const outage=await browser.newPage({viewport:{width:390,height:900}}),outageErrors=[];outage.on('pageerror',error=>outageErrors.push(error.message));
  const block=route=>route.request().url().endsWith('/app.js')?route.continue():route.abort();await outage.route('**/*.js',block);
  await outage.goto('http://127.0.0.1:'+server.address().port+'/');await outage.getByRole('button',{name:'Ask AI',exact:true}).click();await outage.getByText('JKTL AI couldn’t load.',{exact:false}).waitFor();
  assert.deepEqual(await outage.evaluate(()=>window.fixtureTransport.calls),{create:0,send:0,read:0,human:0});await outage.unroute('**/*.js',block);await outage.getByRole('button',{name:'Retry loading chat',exact:true}).click();await outage.getByRole('dialog',{name:'JKTL AI'}).waitFor();assert.deepEqual(outageErrors,[]);await outage.close();
  console.log('Ask AI failed-chunk recovery passed. All transports were fixtures; no live support records or AI requests.');
 }catch(error){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'/tmp/ask-ai-conversation-failure.png',fullPage:true});throw error;}
 finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
